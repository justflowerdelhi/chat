import { getOpenAI } from '@/lib/openaiClient';
import { IFA_ASSISTANT_PROMPT } from '@/lib/ifaPrompt';
import { resolveIfaKnowledge, getMemberContact } from '@/lib/ifa/knowledge';
import type { IfaChannelContext } from '@/lib/whatsappChannel';
import type { IfaMember } from '@/lib/ifa/types';

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
 * Build the IFA knowledge context for the LLM.
 * Organizes knowledge by category and includes recent member results for follow-ups.
 */
async function buildIfaKnowledgeContext(
  messages: IfaMessage[],
  recentMembers: IfaMember[]
): Promise<string> {
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  // Resolve knowledge for the current query
  const knowledge = await resolveIfaKnowledge({ text: lastUserMessage });

  // Check for follow-up contact queries (phone, address, etc.)
  const lower = lastUserMessage.toLowerCase();
  const isContactFollowUp =
    (lower.includes('phone') ||
      lower.includes('address') ||
      lower.includes('contact') ||
      lower.includes('number')) &&
    recentMembers.length > 0;

  let contactSection = '';
  if (isContactFollowUp) {
    // Assume follow-up refers to the most recent member
    const member = recentMembers[0];
    contactSection = `\n\nRECENT MEMBER CONTACT:\n${member.businessName}\n${member.address ? `Address: ${member.address}` : ''}\n${member.phone ? `Phone: ${member.phone}` : ''}`;
  }

  // Organize by category
  const sections: string[] = [];
  sections.push(`CATEGORY: ${knowledge.category.toUpperCase()}`);
  sections.push(`SOURCE: ${knowledge.source}`);
  sections.push(knowledge.text);
  if (contactSection) sections.push(contactSection);

  return sections.join('\n\n');
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
    // Extract recent member results from conversation history (simple heuristic)
    const recentMembers: IfaMember[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.content.includes('IFA members')) {
        // This is a simplified extraction; in production, parse structured results
        // For now, we rely on the knowledge layer to provide context
      }
    }

    const knowledge = await buildIfaKnowledgeContext(messages, recentMembers);

    const systemPrompt = IFA_ASSISTANT_PROMPT.replace('{BUSINESS_NAME}', context.businessName)
      .replace('{TIMEZONE}', context.timezone)
      .replace('{IFA_KNOWLEDGE}', knowledge);

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
