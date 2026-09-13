import { getOpenAI } from '@/lib/openaiClient';
import { IFA_ASSISTANT_PROMPT } from '@/lib/ifaPrompt';
import { resolveIfaKnowledge, getMemberContact } from '@/lib/ifa/knowledge';
import type { IfaChannelContext } from '@/lib/whatsappChannel';
import type { IfaMember } from '@/lib/ifa/types';
import {
  getRecentMemberResult,
  saveMemberSearchResult,
} from '@/lib/ifaSession';

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
  sessionId?: string;
}

const IFA_FALLBACK_REPLY =
  "Sorry, I'm having trouble answering right now. Please try again in a little while.";

/**
 * Build the IFA knowledge context for the LLM.
 * Organizes knowledge by category and includes recent member results for follow-ups.
 */
async function buildIfaKnowledgeContext(
  messages: IfaMessage[],
  sessionId?: string
): Promise<{ knowledge: string; membersToSave?: IfaMember[]; searchType?: string; searchQuery?: string }> {
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  // Check for follow-up contact queries (phone, address, etc.)
  const lower = lastUserMessage.toLowerCase();
  const isContactFollowUp =
    (lower.includes('phone') ||
      lower.includes('address') ||
      lower.includes('contact') ||
      lower.includes('number')) &&
    !lower.includes('ifa') &&
    !lower.includes('association');

  let contactSection = '';
  let recentMembers: IfaMember[] = [];

  if (isContactFollowUp && sessionId) {
    // Try to get recent member results from session state
    const recentResult = await getRecentMemberResult(sessionId);
    if (recentResult && recentResult.members.length > 0) {
      recentMembers = recentResult.members;
      const member = recentMembers[0];
      contactSection = `\n\nRECENT MEMBER SEARCH RESULT:\n${member.businessName}\n${member.address ? `Address: ${member.address}` : ''}\n${member.phone ? `Phone: ${member.phone}` : ''}`;
    }
  }

  // Resolve knowledge for the current query
  const knowledge = await resolveIfaKnowledge({ text: lastUserMessage, recentMembers });

  // If this was a member search with results, save them for follow-ups
  let membersToSave: IfaMember[] | undefined;
  let searchType: string | undefined;
  let searchQuery: string | undefined;

  if (knowledge.category === 'member' && knowledge.members && knowledge.members.length > 0) {
    membersToSave = knowledge.members;
    searchType = knowledge.searchType;
    searchQuery = knowledge.searchQuery;
  }

  // Organize by category
  const sections: string[] = [];
  sections.push(`CATEGORY: ${knowledge.category.toUpperCase()}`);
  sections.push(`SOURCE: ${knowledge.source}`);
  sections.push(knowledge.text);
  if (contactSection) sections.push(contactSection);

  return {
    knowledge: sections.join('\n\n'),
    membersToSave,
    searchType,
    searchQuery,
  };
}

/**
 * Run one IFA assistant turn and return the reply text.
 * The webhook sends the reply; this function never sends WhatsApp messages.
 */
export async function runIFAConversation(
  input: RunIfaConversationInput
): Promise<IfaConversationResult> {
  const { messages, context, sessionId } = input;

  try {
    const { knowledge, membersToSave, searchType, searchQuery } = await buildIfaKnowledgeContext(messages, sessionId);

    // Save member search results for follow-ups
    if (sessionId && membersToSave && membersToSave.length > 0 && searchType && searchQuery) {
      await saveMemberSearchResult(sessionId, membersToSave, searchType as any, searchQuery);
    }

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
