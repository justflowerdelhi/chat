/**
 * Multi-channel WhatsApp routing.
 *
 * Resolves an incoming Meta `phone_number_id` to a business channel
 * ("florist" | "ifa") and dispatches to the correct conversation handler.
 *
 * An unknown production phone_number_id resolves to "unknown" and must never
 * fall back to Just Flowers or any other business.
 */

/** WhatsApp Business account row resolved from public.whatsapp_accounts. */
export interface WhatsAppAccount {
  memberId: number;
  businessName: string;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  notificationPhoneNumber: string | null;
  isActive: boolean;
}

/** Minimal sender identity needed to call the Meta send API. */
export interface WhatsAppSender {
  phoneNumberId: string;
  accessToken: string;
}

export type WhatsAppChannelType = 'florist' | 'ifa';

export interface FloristChannelContext {
  type: 'florist';
  phoneNumberId: string;
  account: WhatsAppAccount;
}

export interface IfaChannelContext {
  type: 'ifa';
  phoneNumberId: string;
  businessName: string;
  language: string;
  timezone: string;
  purpose: 'ifa';
}

export interface UnknownChannelContext {
  type: 'unknown';
  phoneNumberId: string;
}

export type WhatsAppChannelContext =
  | FloristChannelContext
  | IfaChannelContext
  | UnknownChannelContext;

export type WhatsAppAccountLookup = (
  phoneNumberId: string
) => Promise<WhatsAppAccount | undefined>;

export function getIfaPhoneNumberId(): string | undefined {
  const id = process.env.IFA_WHATSAPP_PHONE_NUMBER_ID?.trim();
  return id || undefined;
}

export function isIfaPhoneNumberId(phoneNumberId: string): boolean {
  const ifaId = getIfaPhoneNumberId();
  return !!ifaId && phoneNumberId.trim() === ifaId;
}

/**
 * Resolve an incoming phone_number_id to a channel.
 *
 * - IFA phone number id (env)      -> "ifa"
 * - active row in whatsapp_accounts -> "florist"
 * - anything else                   -> "unknown" (never falls back to a business)
 */
export async function resolveWhatsAppChannel(
  phoneNumberId: string,
  lookupAccount: WhatsAppAccountLookup
): Promise<WhatsAppChannelContext> {
  if (isIfaPhoneNumberId(phoneNumberId)) {
    return {
      type: 'ifa',
      phoneNumberId,
      businessName: 'Indian Florist Association',
      language: 'en',
      timezone: 'Asia/Kolkata',
      purpose: 'ifa',
    };
  }

  const account = await lookupAccount(phoneNumberId);
  if (account) {
    return { type: 'florist', phoneNumberId, account };
  }

  return { type: 'unknown', phoneNumberId };
}

/**
 * Resolve the sender used to reply from the IFA number.
 *
 * The IFA number lives in the same WhatsApp Business Account, so the shared
 * WABA access token works. Priority:
 *   1. IFA_WHATSAPP_ACCESS_TOKEN (dedicated override)
 *   2. WHATSAPP_ACCESS_TOKEN (shared WABA token)
 *   3. an active whatsapp_accounts row for the IFA phone_number_id
 */
export async function resolveIfaSender(
  lookupAccount: WhatsAppAccountLookup
): Promise<WhatsAppSender | null> {
  const phoneNumberId = getIfaPhoneNumberId();
  if (!phoneNumberId) {
    return null;
  }

  const envToken =
    process.env.IFA_WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (envToken) {
    return { phoneNumberId, accessToken: envToken };
  }

  const account = await lookupAccount(phoneNumberId);
  if (account?.accessToken) {
    return {
      phoneNumberId: account.phoneNumberId,
      accessToken: account.accessToken,
    };
  }

  return null;
}

/**
 * Dispatch a resolved channel to its conversation handler.
 * "unknown" channels only run the optional unknown handler (log + safe 200).
 */
export async function dispatchWhatsAppChannel(
  channel: WhatsAppChannelContext,
  handlers: {
    florist: (channel: FloristChannelContext) => Promise<void> | void;
    ifa: (channel: IfaChannelContext) => Promise<void> | void;
    unknown?: (channel: UnknownChannelContext) => Promise<void> | void;
  }
): Promise<void> {
  if (channel.type === 'florist') {
    await handlers.florist(channel);
    return;
  }
  if (channel.type === 'ifa') {
    await handlers.ifa(channel);
    return;
  }
  await handlers.unknown?.(channel);
}
