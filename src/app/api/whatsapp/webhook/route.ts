import { NextResponse } from "next/server";
import { runReceptionConversation } from "@/lib/receptionConversation";
import { getWhatsAppConfig } from "@/lib/whatsappConfig";
import type { ReceptionContext } from "@/lib/receptionContext";
import db from "@/lib/db";
import { DEMO_CATALOGUE, type DemoCatalogueProduct } from "@/lib/demoCatalogue";

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
    `https://graph.facebook.com/v26.0/${account.phoneNumberId}/messages`,
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
  product: DemoCatalogueProduct,
  account: WhatsAppAccount
) {
  const caption =
    `*${product.name}*\n` +
    `${product.description}\n` +
    `Price: ₹${product.price.toLocaleString("en-IN")}`;

  const response = await fetch(
    `https://graph.facebook.com/v26.0/${account.phoneNumberId}/messages`,
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
    throw new Error(
      `WhatsApp image send failed: ${response.status} ${await response.text()}`
    );
  }
}

/**
 * Deterministic demo catalogue trigger.
 *
 * This does NOT depend on GPT understanding the word "bouquet".
 * If the customer explicitly asks for flowers/bouquets/photos/catalogue,
 * we select products here and send them directly.
 */
function getDirectCatalogueMatches(message: string): DemoCatalogueProduct[] {
  const text = message.toLowerCase().replace(/,/g, "");

  const catalogueIntent =
    /\b(bouquet|bouquets|flower|flowers|floral|rose|roses|lily|lilies|orchid|arrangement|arrangements|photo|photos|pic|pics|picture|pictures|image|images|catalog|catalogue|design|designs|show|options)\b/.test(
      text
    );

  if (!catalogueIntent) {
    return [];
  }

  const budgetMatch =
    text.match(/(?:₹|rs\.?|inr)\s*(\d{3,6})/i) ||
    text.match(/\b(?:around|under|within|upto|up to|in|budget)\s*(?:₹|rs\.?|inr)?\s*(\d{3,6})\b/i) ||
    text.match(/\b(\d{3,6})\s*(?:rs|rupees|inr)\b/i);

  const budget = budgetMatch ? Number(budgetMatch[1]) : null;

  let candidates = [...DEMO_CATALOGUE];

  if (budget) {
    const aroundBudget = /\b(around|about|near|approx|approximately)\b/.test(text);

    if (aroundBudget) {
      // For "around ₹1000", allow a practical demo range of ±₹300.
      candidates = candidates.filter(
        (product) => product.price >= Math.max(0, budget - 300) && product.price <= budget + 300
      );
    } else {
      // For "in/under ₹1000", don't exceed the requested budget.
      candidates = candidates.filter((product) => product.price <= budget);
    }

    // If nothing falls in the requested range, show the closest products
    // rather than silently returning nothing.
    if (candidates.length === 0) {
      candidates = [...DEMO_CATALOGUE].sort(
        (a, b) => Math.abs(a.price - budget) - Math.abs(b.price - budget)
      );
    }
  }

  return candidates.slice(0, 3);
}

async function handleMessage(message: WhatsAppTextMessage, phoneNumberId: string) {
  if (message.type !== "text" || !message.text?.body) return;

  const incomingText = message.text.body.trim();

  console.log("WhatsApp incoming message:", {
    from: message.from,
    id: message.id,
    text: incomingText,
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

  /*
   * IMPORTANT:
   * Catalogue matching happens BEFORE GPT.
   * Therefore "Can you show some bouquet in 1000" cannot be missed
   * because of an AI/prompt interpretation issue.
   */
  const directCatalogueProducts = getDirectCatalogueMatches(incomingText);

  if (directCatalogueProducts.length > 0) {
    console.log("Direct catalogue match:", {
      query: incomingText,
      products: directCatalogueProducts.map((product) => ({
        name: product.name,
        price: product.price,
      })),
    });

    await sendWhatsAppText(
      message.from,
      "Here are some bouquet options:",
      account
    );

    for (const product of directCatalogueProducts) {
      await sendWhatsAppImage(message.from, product, account);
    }
  }

  // Keep the normal AI conversation running as before.
  const result = await runReceptionConversation({
    messages: [{ role: "user", content: incomingText }],
    sessionTitle: `WhatsApp ${message.from}`,
    context,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  /*
   * The catalogue may also be selected by the conversation layer.
   * Avoid sending duplicates if the deterministic matcher already sent
   * the products above.
   */
  const aiCatalogueProducts = result.catalogProducts || [];

  if (directCatalogueProducts.length === 0) {
    for (const product of aiCatalogueProducts) {
      await sendWhatsAppImage(message.from, product, account);
    }
  }

  const reply =
    result.reply ||
    "Thank you. Our florist will get back to you shortly.";

  await sendWhatsAppText(message.from, reply, account);

  console.log("WhatsApp outgoing reply:", {
    to: message.from,
    reply,
    directCatalogueProductsSent: directCatalogueProducts.length,
    aiCatalogueProductsSent:
      directCatalogueProducts.length === 0 ? aiCatalogueProducts.length : 0,
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
