import { NextResponse } from "next/server";
import { runReceptionConversation } from "@/lib/receptionConversation";
import { getWhatsAppConfig } from "@/lib/whatsappConfig";
import type { ReceptionContext } from "@/lib/receptionContext";
import db from "@/lib/db";

interface WhatsAppTextMessage {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
}

interface WhatsAppChangeValue {
  messages?: WhatsAppTextMessage[];
  metadata?: {
    phone_number_id: string;
    display_phone_number: string;
  };
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{ value?: WhatsAppChangeValue }>;
  }>;
}

interface WhatsAppAccount {
  memberId: number;
  businessName: string;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  isActive: boolean;
}

interface CatalogProductForWhatsApp {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}

export async function GET(req: Request) {
  const { webhookVerifyToken } = getWhatsAppConfig();
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === webhookVerifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

async function resolveWhatsAppAccount(phoneNumberId: string): Promise<WhatsAppAccount | undefined> {
  try {
    const result = await db.query<WhatsAppAccount>(
      `
      SELECT
        member_id AS "memberId",
        business_name AS "businessName",
        phone_number_id AS "phoneNumberId",
        access_token AS "accessToken",
        verify_token AS "verifyToken",
        is_active AS "isActive"
      FROM public.whatsapp_accounts
      WHERE phone_number_id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [phoneNumberId]
    );

    if (result.rows.length === 0) {
      console.error("WhatsApp account not found:", phoneNumberId);
      return undefined;
    }

    return result.rows[0];
  } catch (error) {
    console.error("Failed to resolve WhatsApp account:", error);
    return undefined;
  }
}

async function sendWhatsAppText(to: string, message: string, account: WhatsAppAccount) {
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${account.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`);
  }
}

async function sendWhatsAppImage(
  to: string,
  product: CatalogProductForWhatsApp,
  account: WhatsAppAccount
) {
  const caption = `${product.name}\n${product.description}\n₹${product.price.toLocaleString("en-IN")}`;

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${account.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: {
          link: product.imageUrl,
          caption,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`WhatsApp image send failed: ${response.status} ${await response.text()}`);
  }
}

async function handleMessage(message: WhatsAppTextMessage, phoneNumberId: string) {
  if (message.type !== "text" || !message.text?.body) return;

  console.log("WhatsApp incoming message:", {
    from: message.from,
    id: message.id,
    text: message.text.body,
    phoneNumberId,
  });

  const account = await resolveWhatsAppAccount(phoneNumberId);

  if (!account) {
    console.error("Unknown or inactive WhatsApp Phone Number ID:", phoneNumberId);
    return;
  }

  const context: ReceptionContext = {
    memberId: account.memberId,
    businessName: account.businessName,
    channel: "whatsapp",
    language: "en",
    timezone: "UTC",
    purpose: "reception",
  };

  const result = await runReceptionConversation({
    messages: [{ role: "user", content: message.text.body }],
    sessionTitle: `WhatsApp ${message.from}`,
    context,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  const catalogProducts = result.catalogProducts || [];

  for (const product of catalogProducts) {
    await sendWhatsAppImage(message.from, product, account);
  }

  const reply =
    result.reply ||
    "Thank you. Our florist will get back to you shortly.";

  await sendWhatsAppText(message.from, reply, account);

  console.log("WhatsApp outgoing reply:", {
    to: message.from,
    reply,
    productsSent: catalogProducts.length,
    phoneNumberId: account.phoneNumberId,
    memberId: account.memberId,
  });
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as WhatsAppWebhookPayload;

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;

        if (!phoneNumberId) {
          console.log("No phone_number_id in webhook payload");
          continue;
        }

        for (const message of value.messages || []) {
          await handleMessage(message, phoneNumberId);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process WhatsApp webhook" },
      { status: 500 }
    );
  }
}
