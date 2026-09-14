import { NextResponse } from "next/server";
import OpenAI from "openai";
import { runReceptionConversation } from "@/lib/receptionConversation";
import { getWhatsAppConfig, getIfaSystemMemberId } from "@/lib/whatsappConfig";
import type { ReceptionContext } from "@/lib/receptionContext";
import db from "@/lib/db";
import { DEMO_CATALOGUE, type DemoCatalogueProduct } from "@/lib/demoCatalogue";
import { getJustFlowerCatalogueRecommendations } from "@/lib/justflowerCatalogue";
import {
  findFloristByNameOrNearest,
  formatFloristContact,
  formatFloristList,
  getNearestFlorists,
} from "@/lib/floritribeLocator";
import {
  buildMissingLocationMessage,
  detectContactDetailsRequest,
  detectNearestFloristIntent,
  extractLocationFromMessage,
  hasLocationInformation,
  isAffirmativeReply,
} from "@/lib/locationIntent";
import {
  clearLocatorState,
  getLocatorState,
  saveLocatorState,
} from "@/lib/locatorSession";
import type { LocatorSessionState } from "@/lib/locatorSession";
import {
  getIfaSessionState,
  saveIfaSessionState,
} from "@/lib/ifaSession";
import type { IfaSessionState } from "@/lib/ifaSession";
import { runIFAConversation } from "@/lib/ifaConversation";
import {
  dispatchWhatsAppChannel,
  resolveIfaSender,
  resolveWhatsAppChannel,
} from "@/lib/whatsappChannel";
import type {
  IfaChannelContext,
  WhatsAppAccount,
  WhatsAppSender,
} from "@/lib/whatsappChannel";

interface WhatsAppTextMessage {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
  audio?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    voice?: boolean;
  };
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
        notification_phone_number AS "notificationPhoneNumber",
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

async function sendWhatsAppText(to: string, message: string, account: WhatsAppSender) {
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

async function sendFloristEnquiryNotification(
  account: WhatsAppAccount,
  enquiry: {
    customerName: string;
    phone: string;
    occasion: string;
    budget: string;
    deliveryDate: string;
    deliveryCity: string;
    recipient: string;
    preferredFlowers: string;
    recommendedProducts: string;
    leadQuality: "Low" | "Medium" | "High";
    priority: "Low" | "Medium" | "High";
  }
) {
  const notificationNumber = account.notificationPhoneNumber?.replace(/\D/g, "");

  if (!notificationNumber) {
    console.log("No florist notification number configured for member:", account.memberId);
    return;
  }

  const message = [
    "New Flora Assistant Enquiry",
    "",
    `Customer: ${enquiry.customerName || "Not provided"}`,
    `Phone: ${enquiry.phone || "Not provided"}`,
    `Occasion: ${enquiry.occasion || "Not provided"}`,
    `Budget: ${enquiry.budget || "Not provided"}`,
    `Delivery Date: ${enquiry.deliveryDate || "Not provided"}`,
    `Delivery City: ${enquiry.deliveryCity || "Not provided"}`,
    `Recipient: ${enquiry.recipient || "Not provided"}`,
    `Preferred Flowers: ${enquiry.preferredFlowers || "Not provided"}`,
    `Recommended: ${enquiry.recommendedProducts || "Not provided"}`,
    `Lead: ${enquiry.leadQuality} | Priority: ${enquiry.priority}`,
    "",
    "Please contact the customer for further processing.",
  ].join("\n");

  await sendWhatsAppText(notificationNumber, message, account);
}

async function sendWhatsAppImage(
  to: string,
  product: DemoCatalogueProduct,
  account: WhatsAppAccount
) {
  const caption =
    `*${product.name}*\n` +
    `${product.description}\n` +
    `Price: Rs.${product.price.toLocaleString("en-IN")}`;

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

async function getOrCreateWhatsAppSession(
  customerPhone: string,
  userId: number
): Promise<string> {
  const sessionTitle = `WhatsApp ${customerPhone}`;

  const existingSession = await db.query<{ id: string }>(
    `SELECT id
     FROM chat_sessions
     WHERE user_id = $1
       AND title = $2
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, sessionTitle]
  );

  if (existingSession.rows.length > 0) {
    return existingSession.rows[0].id;
  }

  const newSession = await db.query<{ id: string }>(
    'INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id',
    [userId, sessionTitle]
  );

  return newSession.rows[0].id;
}

async function saveLocatorReplyAndSend(
  sessionId: string,
  customerPhone: string,
  incomingText: string,
  reply: string,
  account: WhatsAppAccount
) {
  await db.query(
    'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
    [sessionId, 'user', incomingText]
  );

  await db.query(
    'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
    [sessionId, 'assistant', reply]
  );

  await db.query(
    'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
    [sessionId]
  );

  await sendWhatsAppText(customerPhone, reply, account);
}

/**
 * Deterministic demo catalogue trigger.
 *
 * This does NOT depend on GPT understanding the word "bouquet".
 * If the customer explicitly asks for flowers/bouquets/photos/catalogue,
 * we select products here and send them directly.
 */
function getDemoCatalogueMatches(message: string): DemoCatalogueProduct[] {
  const text = message.toLowerCase().replace(/,/g, "");

  const catalogueIntent =
    /\b(bouquet|bouquets|flower|flowers|floral|rose|roses|lily|lilies|orchid|arrangement|arrangements|photo|photos|pic|pics|picture|pictures|image|images|catalog|catalogue|design|designs|show|options|dikhao|dikhaiye|dikhado|batao|chahiye)\b/.test(
      text
    );

  if (!catalogueIntent) {
    return [];
  }

  const budgetMatch =
    text.match(/(?:Rs.|rs\.?|inr)\s*(\d{3,6})/i) ||
    text.match(/\b(?:around|under|within|upto|up to|in|budget)\s*(?:Rs.|rs\.?|inr)?\s*(\d{3,6})\b/i) ||
    text.match(/\b(\d{3,6})\s*(?:rs|rupees|inr)\b/i);

  const budget = budgetMatch ? Number(budgetMatch[1]) : null;

  let candidates = [...DEMO_CATALOGUE];

  if (budget) {
    const aroundBudget = /\b(around|about|near|approx|approximately)\b/.test(text);

    if (aroundBudget) {
      // For "around Rs.1000", allow a practical demo range of Â±Rs.300.
      candidates = candidates.filter(
        (product) => product.price >= Math.max(0, budget - 300) && product.price <= budget + 300
      );
    } else {
      // For "in/under Rs.1000", don't exceed the requested budget.
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

async function getDirectCatalogueMatches(message: string): Promise<DemoCatalogueProduct[]> {
  try {
    const liveProducts = await getJustFlowerCatalogueRecommendations(message);
    if (liveProducts.length > 0) {
      console.log("Using live JustFlower catalogue:", liveProducts.map((p) => ({
        name: p.name,
        price: p.price,
      })));
      return liveProducts;
    }
  } catch (error) {
    console.error("Live JustFlower catalogue failed:", error);
  }

  // Preserve the existing working demo catalogue as fallback.
  return getDemoCatalogueMatches(message);
}
async function transcribeWhatsAppAudio(
  mediaId: string,
  account: WhatsAppSender,
  mimeType?: string
): Promise<string> {
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v26.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    }
  );

  if (!mediaResponse.ok) {
    throw new Error(
      `WhatsApp media lookup failed: ${mediaResponse.status} ${await mediaResponse.text()}`
    );
  }

  const media = (await mediaResponse.json()) as { url?: string; mime_type?: string };

  if (!media.url) {
    throw new Error("WhatsApp media lookup returned no media URL.");
  }

  const audioResponse = await fetch(media.url, {
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
    },
  });

  if (!audioResponse.ok) {
    throw new Error(
      `WhatsApp media download failed: ${audioResponse.status} ${await audioResponse.text()}`
    );
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  const detectedMime = media.mime_type || mimeType || "audio/ogg";
  const extension =
    detectedMime.includes("mpeg") || detectedMime.includes("mp3")
      ? "mp3"
      : detectedMime.includes("mp4") || detectedMime.includes("m4a")
        ? "m4a"
        : detectedMime.includes("webm")
          ? "webm"
          : "ogg";

  const form = new FormData();
  form.append(
    "file",
    new Blob([audioBuffer], { type: detectedMime }),
    `whatsapp-audio.${extension}`
  );
  form.append("model", "gpt-4o-mini-transcribe");

  const openaiResponse = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    }
  );

  if (!openaiResponse.ok) {
    throw new Error(
      `OpenAI transcription failed: ${openaiResponse.status} ${await openaiResponse.text()}`
    );
  }

  const result = (await openaiResponse.json()) as { text?: string };

  if (!result.text?.trim()) {
    throw new Error("OpenAI returned an empty transcription.");
  }

  return result.text.trim();
}
/**
 * Extract the text the customer sent. Voice notes are transcribed; on failure
 * a fallback reply is sent and "" is returned so the caller can stop.
 */
async function extractIncomingText(
  message: WhatsAppTextMessage,
  sender: WhatsAppSender
): Promise<string> {
  if (message.type === "text") {
    return message.text?.body?.trim() || "";
  }

  const mediaId = message.audio?.id;

  if (!mediaId) {
    console.error("WhatsApp audio message has no media ID:", message.id);
    await sendWhatsAppText(
      message.from,
      "Sorry, I couldn't read that voice message. Please send it again or type your request.",
      sender
    );
    return "";
  }

  try {
    const transcript = await transcribeWhatsAppAudio(
      mediaId,
      sender,
      message.audio?.mime_type
    );

    console.log("WhatsApp voice transcription:", {
      from: message.from,
      id: message.id,
      transcript,
    });

    return transcript;
  } catch (error) {
    console.error("WhatsApp voice transcription failed:", error);

    await sendWhatsAppText(
      message.from,
      "Sorry, I couldn't understand that voice message. Please try again or type your request.",
      sender
    );
    return "";
  }
}

async function handleFloristMessage(
  message: WhatsAppTextMessage,
  account: WhatsAppAccount
) {
  const phoneNumberId = account.phoneNumberId;
  const incomingText = await extractIncomingText(message, account);

  if (!incomingText) return;

  console.log("WhatsApp incoming message:", {
    from: message.from,
    id: message.id,
    text: incomingText,
    phoneNumberId,
  });

  const sessionId = await getOrCreateWhatsAppSession(
    message.from,
    account.memberId
  );
  const rawLocatorState = await getLocatorState(sessionId);
  let locatorState: LocatorSessionState = rawLocatorState || {};

  const isLocatorIntent = detectNearestFloristIntent(incomingText);
  const isAffirmativeContactReply =
    isAffirmativeReply(incomingText) &&
    locatorState.lastResult &&
    (locatorState.lastResult.prompt === 'contact-offer' ||
      !locatorState.lastResult.prompt);
  const isContactRequest =
    detectContactDetailsRequest(incomingText) || isAffirmativeContactReply;
  const locationUpdate = extractLocationFromMessage(incomingText);

  // Contact details follow-up for a recent locator result
  if (isContactRequest && locatorState.lastResult) {
    const florist = findFloristByNameOrNearest(
      locatorState.lastResult.florists,
      isAffirmativeContactReply ? undefined : incomingText
    );

    if (florist) {
      const reply = formatFloristContact(florist);
      await saveLocatorReplyAndSend(
        sessionId,
        message.from,
        incomingText,
        reply,
        account
      );
      await saveLocatorState(sessionId, {
        ...locatorState,
        pending: false,
        lastResult: {
          ...locatorState.lastResult,
          prompt: 'contact-details',
        },
      });
    } else {
      const reply =
        "Sorry, I don't have florist contact details to share right now.";
      await saveLocatorReplyAndSend(
        sessionId,
        message.from,
        incomingText,
        reply,
        account
      );
      await clearLocatorState(sessionId);
      locatorState = {};
    }

    return;
  }

  if (isLocatorIntent || locatorState.pending) {
    if (isLocatorIntent) {
      // A fresh locator request should not inherit stale partial location.
      // Preserve lastResult only until the next successful lookup replaces it.
      locatorState = { lastResult: locatorState.lastResult };
    }

    if (
      locatorState.pending &&
      !isLocatorIntent &&
      !isContactRequest &&
      !hasLocationInformation(incomingText)
    ) {
      // Customer did not provide location and is not asking for contacts.
      // Reset locator state and fall through to the normal flow.
      await clearLocatorState(sessionId);
      locatorState = {};
    } else {
      const city = locationUpdate.city || locatorState.collectedCity;
      const pincode = locationUpdate.pincode || locatorState.collectedPincode;

      if (city && pincode) {
        try {
          const florists = await getNearestFlorists({
            city,
            pincode,
            limit: 3,
          });

          if (florists.length === 0) {
            // No florists for this location: tell the customer and keep the
            // session pending so they can try another PIN code or city.
            const reply = formatFloristList(florists, city, pincode);
            await saveLocatorReplyAndSend(
              sessionId,
              message.from,
              incomingText,
              reply,
              account
            );
            await saveLocatorState(sessionId, {
              ...locatorState,
              pending: true,
              collectedCity: city,
              collectedPincode: undefined,
            });
            return;
          }

          const reply = formatFloristList(florists, city, pincode);
          await saveLocatorReplyAndSend(
            sessionId,
            message.from,
            incomingText,
            reply,
            account
          );

          await saveLocatorState(sessionId, {
            pending: false,
            lastResult: {
              city,
              pincode,
              fetchedAt: new Date().toISOString(),
              florists,
              prompt: 'contact-offer',
            },
          });

          return;
        } catch (error) {
          console.error("Floritribe locator error:", error);
          const fallbackReply =
            "Sorry, I'm unable to check the nearest florists right now. Please try again in a little while.";
          await saveLocatorReplyAndSend(
            sessionId,
            message.from,
            incomingText,
            fallbackReply,
            account
          );
          // Keep the session pending with the attempted location so the
          // customer can retry with a new PIN code or city.
          await saveLocatorState(sessionId, {
            ...locatorState,
            pending: true,
            collectedCity: city,
            collectedPincode: pincode,
          });
          return;
        }
      }

      if (pincode && !city) {
        const reply = "Thanks 😊 Which city is this PIN code in?";
        await saveLocatorReplyAndSend(
          sessionId,
          message.from,
          incomingText,
          reply,
          account
        );
        await saveLocatorState(sessionId, {
          ...locatorState,
          pending: true,
          collectedPincode: pincode,
        });
        return;
      }

      if (city && !pincode) {
        const reply =
          "Sure 😊 Please share the PIN code so I can find the nearest IFA florists.";
        await saveLocatorReplyAndSend(
          sessionId,
          message.from,
          incomingText,
          reply,
          account
        );
        await saveLocatorState(sessionId, {
          ...locatorState,
          pending: true,
          collectedCity: city,
        });
        return;
      }

      // No usable location information yet
      const reply = buildMissingLocationMessage({});
      await saveLocatorReplyAndSend(
        sessionId,
        message.from,
        incomingText,
        reply,
        account
      );
      await saveLocatorState(sessionId, {
        ...locatorState,
        pending: true,
      });
      return;
    }
  }

  // Normal flow: ensure no stale locator state interferes
  await clearLocatorState(sessionId);

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
  const directCatalogueProducts = await getDirectCatalogueMatches(incomingText);

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
    enforceUsageLimit: false,
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  if (result.enquiry) {
    try {
      // WhatsApp already gives us the customer's real phone number.
      // The AI should not be expected to extract it from the conversation.
      const enquiryForNotification = {
        ...result.enquiry,
        phone: result.enquiry.phone?.trim() || message.from,
      };

      console.log("Sending florist enquiry notification:", {
        customerPhone: enquiryForNotification.phone,
        notificationPhone: account.notificationPhoneNumber,
        occasion: enquiryForNotification.occasion,
      });

      await sendFloristEnquiryNotification(account, enquiryForNotification);
    } catch (notificationError) {
      console.error("Failed to notify florist about enquiry:", notificationError);
    }
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

async function handleIfaMessage(
  message: WhatsAppTextMessage,
  channel: IfaChannelContext
) {
  const sender = await resolveIfaSender(resolveWhatsAppAccount);

  if (!sender) {
    console.error(
      "IFA WhatsApp sender is not configured. Set IFA_WHATSAPP_PHONE_NUMBER_ID and a WABA access token (WHATSAPP_ACCESS_TOKEN or IFA_WHATSAPP_ACCESS_TOKEN).",
      { phoneNumberId: channel.phoneNumberId }
    );
    return;
  }

  const incomingText = await extractIncomingText(message, sender);
  if (!incomingText) return;

  console.log("IFA WhatsApp incoming message:", {
    from: message.from,
    id: message.id,
    text: incomingText,
    phoneNumberId: channel.phoneNumberId,
  });

  // Create or get session for conversation state
  // IFA is association-wide, use the IFA system member ID for session persistence
  const ifaSystemMemberId = getIfaSystemMemberId();
  const sessionId = await getOrCreateWhatsAppSession(message.from, ifaSystemMemberId);

  // Check for nearest florist intent - use proven locator logic
  const isLocatorIntent = detectNearestFloristIntent(incomingText);
  const rawIfaState = await getIfaSessionState(sessionId);
  let ifaState: IfaSessionState = rawIfaState || {};
  const locationUpdate = extractLocationFromMessage(incomingText);

  // Handle nearest florist queries using the proven locator flow
  if (isLocatorIntent || ifaState.pending) {
    if (isLocatorIntent) {
      // Fresh locator request - preserve member results but reset location state
      ifaState = {
        lastMemberResult: ifaState.lastMemberResult,
        pending: false,
        collectedCity: undefined,
        collectedPincode: undefined,
      };
    }

    if (
      ifaState.pending &&
      !isLocatorIntent &&
      !hasLocationInformation(incomingText)
    ) {
      // Customer did not provide location - reset and fall through to normal IFA flow
      await saveIfaSessionState(sessionId, {
        lastMemberResult: ifaState.lastMemberResult,
      });
      ifaState = { lastMemberResult: ifaState.lastMemberResult };
    } else {
      const city = locationUpdate.city || ifaState.collectedCity;
      const pincode = locationUpdate.pincode || ifaState.collectedPincode;

      // If this is a fresh locator intent with no location, ask for location
      if (isLocatorIntent && !city && !pincode) {
        const reply = buildMissingLocationMessage({});

        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'user', incomingText]
        );
        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'assistant', reply]
        );
        await db.query(
          'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
          [sessionId]
        );

        await sendWhatsAppText(message.from, reply, sender);

        await saveIfaSessionState(sessionId, {
          ...ifaState,
          pending: true,
        });

        return;
      }

      if (city && pincode) {
        // Both city and pincode - call the locator
        try {
          const florists = await getNearestFlorists({
            city,
            pincode,
            limit: 3,
          });

          const reply = formatFloristList(florists, city, pincode, true, true);

          // Save IFA conversation messages
          await db.query(
            'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
            [sessionId, 'user', incomingText]
          );
          await db.query(
            'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
            [sessionId, 'assistant', reply]
          );
          await db.query(
            'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
            [sessionId]
          );

          await sendWhatsAppText(message.from, reply, sender);

          // Clear location state but preserve member results
          await saveIfaSessionState(sessionId, {
            lastMemberResult: ifaState.lastMemberResult,
          });

          return;
        } catch (error) {
          console.error("IFA locator error:", error);
          const fallbackReply =
            "Sorry, I'm unable to check the nearest florists right now. Please try again in a little while.";

          await db.query(
            'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
            [sessionId, 'user', incomingText]
          );
          await db.query(
            'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
            [sessionId, 'assistant', fallbackReply]
          );
          await db.query(
            'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
            [sessionId]
          );

          await sendWhatsAppText(message.from, fallbackReply, sender);

          // Keep pending state for retry
          await saveIfaSessionState(sessionId, {
            ...ifaState,
            pending: true,
            collectedCity: city,
            collectedPincode: pincode,
          });

          return;
        }
      }

      if (pincode && !city) {
        // Have pincode, need city
        const reply = "Thanks 😊 Which city is this PIN code in?";

        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'user', incomingText]
        );
        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'assistant', reply]
        );
        await db.query(
          'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
          [sessionId]
        );

        await sendWhatsAppText(message.from, reply, sender);

        await saveIfaSessionState(sessionId, {
          ...ifaState,
          pending: true,
          collectedPincode: pincode,
        });

        return;
      }

      if (city && !pincode) {
        // Have city, need pincode
        const reply =
          "Sure 😊 Please share the PIN code so I can find the nearest IFA florists.";

        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'user', incomingText]
        );
        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [sessionId, 'assistant', reply]
        );
        await db.query(
          'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
          [sessionId]
        );

        await sendWhatsAppText(message.from, reply, sender);

        await saveIfaSessionState(sessionId, {
          ...ifaState,
          pending: true,
          collectedCity: city,
        });

        return;
      }
    }
  }

  // Normal IFA conversation flow (non-locator queries)
  const result = await runIFAConversation({
    messages: [{ role: "user", content: incomingText }],
    context: channel,
    sessionId,
  });

  // Save IFA conversation messages to chat_messages for history
  await db.query(
    'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
    [sessionId, 'user', incomingText]
  );

  await db.query(
    'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
    [sessionId, 'assistant', result.reply]
  );

  await db.query(
    'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
    [sessionId]
  );

  await sendWhatsAppText(message.from, result.reply, sender);

  console.log("IFA WhatsApp outgoing reply:", {
    to: message.from,
    reply: result.reply,
    phoneNumberId: channel.phoneNumberId,
  });
}

async function handleMessage(message: WhatsAppTextMessage, phoneNumberId: string) {
  if (message.type !== "text" && message.type !== "audio") {
    console.log("Ignoring unsupported WhatsApp message type:", message.type);
    return;
  }

  const channel = await resolveWhatsAppChannel(
    phoneNumberId,
    resolveWhatsAppAccount
  );

  await dispatchWhatsAppChannel(channel, {
    florist: (floristChannel) =>
      handleFloristMessage(message, floristChannel.account),
    ifa: (ifaChannel) => handleIfaMessage(message, ifaChannel),
    unknown: (unknownChannel) => {
      // Never fall back to Just Flowers or another business. Log and return so
      // Meta still gets HTTP 200 and does not keep retrying the webhook.
      console.error(
        "Unknown WhatsApp Phone Number ID (no channel resolved):",
        unknownChannel.phoneNumberId
      );
    },
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




