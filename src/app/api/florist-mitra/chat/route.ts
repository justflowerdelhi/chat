import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { FLORIST_MITRA_PROMPT } from "@/lib/floristPrompt";
import { getCurrentUser } from "@/lib/auth";
import db from "@/lib/db";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'Missing OpenAI API key. Please set the OPENAI_API_KEY environment variable.'
      );
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

const MONTHLY_LIMIT = 50; // Questions per month
const HANDOFF_PHRASE = "I'll pass these details to our florist who will contact you shortly.";

interface ChatHistoryRow extends QueryResultRow {
  role: 'user' | 'assistant';
  content: string;
}

interface EnquirySummary {
  customerName: string;
  phone: string;
  occasion: string;
  budget: string;
  deliveryDate: string;
  deliveryCity: string;
  recipient: string;
  preferredFlowers: string;
  recommendedProducts: string;
  urgency: string;
  specialInstructions: string;
  missingInformation: string;
  leadQuality: 'Low' | 'Medium' | 'High';
  suggestedNextAction: string;
  conversationConfidence: number;
  priority: 'Low' | 'Medium' | 'High';
  summaryText: string;
}

function textValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').join(', ');
  }

  return typeof value === 'string' ? value : '';
}

function choiceValue(value: unknown): 'Low' | 'Medium' | 'High' {
  return value === 'Low' || value === 'Medium' || value === 'High' ? value : 'Medium';
}

function confidenceValue(value: unknown): number {
  return typeof value === 'number' && value >= 0 && value <= 100 ? Math.round(value) : 0;
}

function parseEnquirySummary(content: string | null): EnquirySummary | null {
  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const leadQuality = choiceValue(parsed.leadQuality);

    return {
      customerName: textValue(parsed.customerName),
      phone: textValue(parsed.phone),
      occasion: textValue(parsed.occasion),
      budget: textValue(parsed.budget),
      deliveryDate: textValue(parsed.deliveryDate),
      deliveryCity: textValue(parsed.deliveryCity),
      recipient: textValue(parsed.recipient),
      preferredFlowers: textValue(parsed.preferredFlowers),
      recommendedProducts: textValue(parsed.recommendedProducts),
      urgency: textValue(parsed.urgency),
      specialInstructions: textValue(parsed.specialInstructions),
      missingInformation: textValue(parsed.missingInformation),
      leadQuality,
      suggestedNextAction: textValue(parsed.suggestedNextAction),
      conversationConfidence: confidenceValue(parsed.conversationConfidence),
      priority: choiceValue(parsed.priority || leadQuality),
      summaryText: textValue(parsed.summaryText),
    };
  } catch {
    return null;
  }
}

function isCompletedConversation(reply: string | null): boolean {
  return reply?.toLowerCase().includes(HANDOFF_PHRASE.toLowerCase()) ?? false;
}

async function createEnquiryIfCompleted(
  conversationId: string,
  historyMessages: ChatHistoryRow[],
  reply: string | null
) {
  if (!isCompletedConversation(reply)) {
    return;
  }

  try {
    const summaryResponse = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract one florist enquiry from the completed conversation.
Return only valid JSON with these camelCase fields: customerName, phone, occasion, budget, deliveryDate, deliveryCity, recipient, preferredFlowers, recommendedProducts, urgency, specialInstructions, missingInformation, leadQuality, suggestedNextAction, conversationConfidence, priority, summaryText.
Use only information present in the conversation. Leave unknown fields as empty strings.
leadQuality and priority must be Low, Medium or High. conversationConfidence must be a number from 0 to 100.
Do not create orders, confirm payment, confirm delivery or invent values.`,
        },
        ...historyMessages,
        {
          role: "assistant",
          content: reply ?? '',
        },
      ],
    });

    const summary = parseEnquirySummary(summaryResponse.choices[0].message.content);
    if (!summary) {
      return;
    }

    await db.query(
      `INSERT INTO enquiries (
        conversation_id,
        customer_name,
        phone,
        occasion,
        budget,
        delivery_date,
        delivery_city,
        recipient,
        recommended_products,
        special_instructions,
        summary,
        lead_quality,
        conversation_confidence,
        priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)
      ON CONFLICT (conversation_id) DO NOTHING`,
      [
        conversationId,
        summary.customerName,
        summary.phone,
        summary.occasion,
        summary.budget,
        summary.deliveryDate,
        summary.deliveryCity,
        summary.recipient,
        summary.recommendedProducts,
        summary.specialInstructions,
        JSON.stringify(summary),
        summary.leadQuality,
        summary.conversationConfidence,
        summary.priority,
      ]
    );
  } catch (error) {
    console.error('Error creating enquiry:', error);
  }
}

async function checkUsageLimit(userId: number): Promise<{ allowed: boolean; remaining: number }> {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  
  const result = await db.query(
    'SELECT questions FROM member_usage WHERE user_id = $1 AND month = $2',
    [userId, currentMonth]
  );

  if (result.rowCount === 0) {
    // First usage this month
    await db.query(
      'INSERT INTO member_usage (user_id, month, questions) VALUES ($1, $2, 0)',
      [userId, currentMonth]
    );
    return { allowed: true, remaining: MONTHLY_LIMIT };
  }

  const currentUsage = result.rows[0].questions;
  const remaining = MONTHLY_LIMIT - currentUsage;
  
  return { allowed: remaining > 0, remaining };
}

async function incrementUsage(userId: number): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  await db.query(
    `UPDATE member_usage 
     SET questions = questions + 1, updated_at = NOW() 
     WHERE user_id = $1 AND month = $2`,
    [userId, currentMonth]
  );
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.member_id) {
      return NextResponse.json({ error: "Unauthorized. Only IFA members can access Florist Mitra." }, { status: 401 });
    }

    // Check usage limit
    const usageCheck = await checkUsageLimit(user.member_id);
    if (!usageCheck.allowed) {
      return NextResponse.json({ 
        error: "Monthly limit reached. You have used all your questions for this month.",
        remaining: 0
      }, { status: 429 });
    }

    const body = await req.json();
    const { messages, sessionId } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

    // Save user message to database
    let currentSessionId = sessionId;
    
    if (currentSessionId) {
      // Verify session belongs to user
      const sessionCheck = await db.query(
        'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
        [currentSessionId, user.member_id]
      );
      
      if (sessionCheck.rowCount === 0) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }

      // Save message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [currentSessionId, 'user', lastMessage.content]
        );
      }
    } else {
      // Create new session
      const sessionResult = await db.query(
        'INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id',
        [user.member_id, messages[0]?.content?.substring(0, 50) || 'New Chat']
      );
      currentSessionId = sessionResult.rows[0].id;

      // Save first message
      const firstMessage = messages[0];
      if (firstMessage && firstMessage.role === 'user') {
        await db.query(
          'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
          [currentSessionId, 'user', firstMessage.content]
        );
      }
    }

    // Get chat history for context
    const historyResult = await db.query<ChatHistoryRow>(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20',
      [currentSessionId]
    );

    const historyMessages = historyResult.rows.map((msg: ChatHistoryRow) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Call OpenAI
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: FLORIST_MITRA_PROMPT,
        },
        ...historyMessages,
      ],
    });

    const reply = response.choices[0].message.content;

    // Save assistant response
    await db.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [currentSessionId, 'assistant', reply]
    );

    // Update session timestamp
    await db.query(
      'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
      [currentSessionId]
    );

    // Increment usage
    await incrementUsage(user.member_id);

    await createEnquiryIfCompleted(currentSessionId, historyMessages, reply);

    return NextResponse.json({
      reply,
      sessionId: currentSessionId,
      remaining: usageCheck.remaining - 1,
    });
  } catch (error) {
    console.error("Florist Mitra chat error:", error);
    return NextResponse.json({ error: "Failed to process chat request" }, { status: 500 });
  }
}
