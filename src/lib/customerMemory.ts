import type { ReceptionMessage } from '@/lib/receptionConversation';
import { getOpenAI } from '@/lib/openaiClient';
import { upsertCustomerProfile } from '@/lib/floristData';

interface CustomerMemoryJson {
  name?: string;
  preferences?: string;
  favourite_flowers?: string;
  favourite_colours?: string;
  occasions?: string;
  budget?: string;
  delivery_address?: string;
  last_purchase?: string;
  open_quote?: string;
  last_ai_summary?: string;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  return undefined;
}

function parseMemory(content: string | null): CustomerMemoryJson | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      name: textValue(parsed.name),
      preferences: textValue(parsed.preferences),
      favourite_flowers: textValue(parsed.favourite_flowers),
      favourite_colours: textValue(parsed.favourite_colours),
      occasions: textValue(parsed.occasions),
      budget: textValue(parsed.budget),
      delivery_address: textValue(parsed.delivery_address),
      last_purchase: textValue(parsed.last_purchase),
      open_quote: textValue(parsed.open_quote),
      last_ai_summary: textValue(parsed.last_ai_summary),
    };
  } catch {
    return null;
  }
}

export async function updateCustomerMemory(
  memberId: number,
  customerPhone: string,
  currentMessage: string,
  assistantReply: string,
  history: ReceptionMessage[]
): Promise<void> {
  if (!currentMessage || !assistantReply) {
    return;
  }

  const recentHistory = history.slice(-10);

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a customer memory extraction assistant for a florist AI.
Given the conversation, extract what is known about the customer into a JSON object with these exact fields:
- name
- preferences
- favourite_flowers
- favourite_colours
- occasions
- budget
- delivery_address
- last_purchase
- open_quote
- last_ai_summary

Rules:
- Use only information explicitly stated or strongly implied by the customer.
- Do not invent names, numbers, addresses, or budgets.
- Leave a field as an empty string if unknown.
- last_ai_summary should be a 1-2 sentence summary of the customer's current intent.
- open_quote should be a short description of any quote being discussed, if any.
Return only the JSON object, no explanation.`,
        },
        ...recentHistory.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: currentMessage },
        { role: 'assistant', content: assistantReply },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    const parsed = parseMemory(raw);

    if (!parsed) {
      console.error('Failed to parse customer memory:', raw);
      return;
    }

    await upsertCustomerProfile(memberId, customerPhone, {
      name: parsed.name,
      preferences: parsed.preferences,
      favourite_flowers: parsed.favourite_flowers,
      favourite_colours: parsed.favourite_colours,
      occasions: parsed.occasions,
      budget: parsed.budget,
      delivery_address: parsed.delivery_address,
      last_purchase: parsed.last_purchase,
      open_quote: parsed.open_quote,
      last_ai_summary: parsed.last_ai_summary,
    });
  } catch (error) {
    console.error('Error updating customer memory:', error);
  }
}
