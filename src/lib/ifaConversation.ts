import { getOpenAI } from '@/lib/openaiClient';
import { IFA_ASSISTANT_PROMPT } from '@/lib/ifaPrompt';
import type { IfaChannelContext } from '@/lib/whatsappChannel';

export interface IfaMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface IfaConversationResult {
  reply: string;
}

export interface RunIfaConversationInput {
  messages: IfaMessage[];
  context: IfaChannelContext;
}

const IFA_FALLBACK_REPLY =
  "Sorry, I'm having trouble answering right now. Please try again in a little while.";

/**
 * IFA knowledge/data layer.
 *
 * Deliberately kept separate from the conversation logic so the real IFA
 * website, database or documents can be connected later without touching the
 * assistant. Until a source is wired in it returns an empty string, which
 * makes the assistant honestly say it does not have the detail yet instead of
 * inventing IFA facts.
 */
export async function getIfaKnowledgeContext(): Promise<string> {
  // TODO: connect the real IFA knowledge source (website / DB / documents).
  return '';
}

function buildIfaSystemPrompt(
  context: IfaChannelContext,
  knowledge: string
): string {
  const knowledgeBlock = knowledge.trim()
    ? knowledge.trim()
    : 'No IFA knowledge source is connected yet. If you do not have a detail, say so and offer to connect the person with the IFA team.';

  return IFA_ASSISTANT_PROMPT.replace('{BUSINESS_NAME}', context.businessName)
    .replace('{TIMEZONE}', context.timezone)
    .replace('{IFA_KNOWLEDGE}', knowledgeBlock);
}

/**
 * Run one IFA assistant turn and return the reply text.
 * The webhook sends the reply; this function never sends WhatsApp messages.
 */
export async function runIFAConversation(
  input: RunIfaConversationInput
): Promise<IfaConversationResult> {
  const { messages, context } = input;

  try {
    const knowledge = await getIfaKnowledgeContext();
    const systemPrompt = buildIfaSystemPrompt(context, knowledge);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    return { reply: reply || IFA_FALLBACK_REPLY };
  } catch (error) {
    console.error('IFA conversation error:', error);
    return { reply: IFA_FALLBACK_REPLY };
  }
}
