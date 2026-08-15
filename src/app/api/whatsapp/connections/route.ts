import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { encryptToken } from '@/lib/encryption';
import {
  createWhatsAppConnection,
  deleteWhatsAppConnectionByMemberId,
  getWhatsAppConnectionByMemberId,
  type WhatsAppConnectionRow,
} from '@/lib/whatsappConnection';

const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';

interface WhatsAppConnectionPublic {
  id: string;
  member_id: number;
  business_id: string | null;
  waba_id: string;
  phone_number_id: string;
  display_phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function toPublic(connection: WhatsAppConnectionRow): WhatsAppConnectionPublic {
  return {
    id: connection.id,
    member_id: connection.member_id,
    business_id: connection.business_id,
    waba_id: connection.waba_id,
    phone_number_id: connection.phone_number_id,
    display_phone: connection.display_phone,
    status: connection.status,
    created_at: connection.created_at,
    updated_at: connection.updated_at,
  };
}

interface FacebookTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<string> {
  const url = `${GRAPH_API_BASE}/oauth/access_token?code=${encodeURIComponent(code)}&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = (await response.json()) as FacebookTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function exchangeForLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const url = `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = (await response.json()) as FacebookTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

interface WABANode {
  id: string;
  name?: string;
}

async function fetchWABAs(longLivedToken: string): Promise<WABANode[]> {
  const url = `${GRAPH_API_BASE}/me/whatsapp_business_accounts?access_token=${encodeURIComponent(longLivedToken)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json() as { data?: WABANode[]; error?: { message: string } };

  if (!response.ok) {
    throw new Error(`Failed to fetch WABA accounts: ${JSON.stringify(data)}`);
  }

  return data.data || [];
}

interface WABADetails {
  id: string;
  name?: string;
  owner_business_info?: { id?: string; name?: string };
}

async function fetchWABADetails(wabaId: string, longLivedToken: string): Promise<WABADetails> {
  const url = `${GRAPH_API_BASE}/${wabaId}?fields=id,name,owner_business_info&access_token=${encodeURIComponent(longLivedToken)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json() as WABADetails & { error?: { message: string } };

  if (!response.ok) {
    throw new Error(`Failed to fetch WABA details: ${JSON.stringify(data)}`);
  }

  return data;
}

interface PhoneNumberNode {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  status?: string;
}

async function fetchPhoneNumbers(wabaId: string, longLivedToken: string): Promise<PhoneNumberNode[]> {
  const url = `${GRAPH_API_BASE}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(longLivedToken)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json() as { data?: PhoneNumberNode[]; error?: { message: string } };

  if (!response.ok) {
    throw new Error(`Failed to fetch phone numbers: ${JSON.stringify(data)}`);
  }

  return data.data || [];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connection = await getWhatsAppConnectionByMemberId(user.member_id);
  if (!connection) {
    return NextResponse.json({ connection: null });
  }

  return NextResponse.json({ connection: toPublic(connection) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'Meta app is not configured' }, { status: 500 });
  }

  try {
    const body = await req.json() as { code: string; redirectUri?: string };
    const { code, redirectUri } = body;

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    const finalRedirectUri = redirectUri || process.env.META_REDIRECT_URI || 'https://chat.floraprise.com/settings/whatsapp';

    const shortToken = await exchangeCodeForToken(code, appId, appSecret, finalRedirectUri);
    const longToken = await exchangeForLongLivedToken(shortToken, appId, appSecret);

    const wabas = await fetchWABAs(longToken);
    if (wabas.length === 0) {
      return NextResponse.json(
        { error: 'No WhatsApp Business Account found. Complete the Embedded Signup flow.' },
        { status: 400 }
      );
    }

    const waba = wabas[0];
    const wabaDetails = await fetchWABADetails(waba.id, longToken);
    const phoneNumbers = await fetchPhoneNumbers(waba.id, longToken);

    if (phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'No phone numbers found in the WhatsApp Business Account.' },
        { status: 400 }
      );
    }

    const phone = phoneNumbers[0];
    const businessId = wabaDetails.owner_business_info?.id || waba.id;
    const encryptedToken = encryptToken(longToken);

    const connection = await createWhatsAppConnection(
      user.member_id,
      businessId,
      waba.id,
      phone.id,
      phone.display_phone_number,
      encryptedToken,
      'active'
    );

    return NextResponse.json({ connection: toPublic(connection) });
  } catch (error) {
    console.error('WhatsApp connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect WhatsApp. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user?.member_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteWhatsAppConnectionByMemberId(user.member_id);
  return NextResponse.json({ success: true });
}
