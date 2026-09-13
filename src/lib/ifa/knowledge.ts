/**
 * IFA knowledge aggregation.
 *
 * Routes queries to the appropriate knowledge source and formats results
 * for the LLM context.
 */

import type { IfaMember } from './types';
import {
  formatMemberContact,
  formatMemberList,
  getMemberById,
  searchMembersByCity,
  searchMembersByName,
  searchMembersByPincode,
  searchNearestFlorists,
} from './memberSearch';
import { getIfaEvents, getNextIfaMeet, getExhibitionInfo, getPastIfaMeets } from './events';
import { getIfaGeneralInfo } from './general';
import { getIfaLeadership, getLeaderByName, getPresident } from './leadership';
import { getIfaMembershipInfo } from './membership';

export interface IfaQuery {
  text: string;
  category?: 'member' | 'leadership' | 'events' | 'membership' | 'general';
}

export interface IfaKnowledgeContext {
  text: string;
  category: string;
  source: string;
}

/**
 * Detect the likely category of a user query.
 * Improved keyword-based detection for natural language.
 */
function detectQueryCategory(text: string): IfaQuery['category'] {
  const lower = text.toLowerCase();

  // Events - event-related queries (highest priority)
  if (
    lower.includes('ifa meet') ||
    lower.includes('meet') ||
    lower.includes('event') ||
    lower.includes('conference') ||
    lower.includes('exhibition') ||
    lower.includes('registration') ||
    lower.includes('register') ||
    lower.includes('venue') ||
    lower.includes('package') ||
    lower.includes('stall') ||
    lower.includes('sponsor') ||
    (lower.includes('date') && (lower.includes('meet') || lower.includes('event')))
  ) {
    return 'events';
  }

  // Member search - for specific member queries
  if (
    lower.includes('find') ||
    lower.includes('search') ||
    (lower.includes('florist') && !lower.includes('ifa meet')) ||
    (lower.includes('member') && !lower.includes('membership')) ||
    lower.includes('nearest') ||
    lower.includes('near') ||
    lower.includes('city') ||
    lower.includes('pincode') ||
    /\d{6}/.test(text)
  ) {
    return 'member';
  }

  // Member contact details (phone/address for a specific member)
  if (
    (lower.includes('contact') || lower.includes('phone') || lower.includes('address')) &&
    (lower.includes('florist') || lower.includes('member') || lower.includes('shop') || lower.includes('business'))
  ) {
    return 'member';
  }

  // Leadership - specific leadership queries
  if (
    lower.includes('president') ||
    lower.includes('vice president') ||
    lower.includes('secretary') ||
    lower.includes('treasurer') ||
    lower.includes('office bearer') ||
    lower.includes('state head') ||
    lower.includes('who is the') ||
    (lower.includes('who is') && !lower.includes('ifa')) ||
    lower.includes('leadership') ||
    lower.includes('leader') ||
    lower.includes('head')
  ) {
    return 'leadership';
  }

  // Membership - membership-related queries
  if (
    lower.includes('join') ||
    lower.includes('membership') ||
    lower.includes('member fee') ||
    lower.includes('fee') ||
    lower.includes('benefit') ||
    lower.includes('eligible') ||
    lower.includes('eligible categories') ||
    lower.includes('renew') ||
    lower.includes('how much') ||
    lower.includes('cost') ||
    lower.includes('price')
  ) {
    return 'membership';
  }

  // General - what is IFA, contact, about
  if (
    lower.includes('what is') ||
    lower.includes('about ifa') ||
    lower.includes('mission') ||
    lower.includes('vision') ||
    lower.includes('founded') ||
    lower.includes('contact') ||
    lower.includes('email') ||
    lower.includes('phone') ||
    lower.includes('address') ||
    lower.includes('website')
  ) {
    return 'general';
  }

  // Default to general for greetings and unknown queries
  return 'general';
}

/**
 * Handle member search queries.
 */
async function handleMemberQuery(text: string): Promise<IfaKnowledgeContext> {
  const lower = text.toLowerCase();

  // Nearest florist / location-based
  if (
    lower.includes('nearest') ||
    lower.includes('near') ||
    lower.includes('pincode') ||
    /\d{6}/.test(text)
  ) {
    // Extract pincode if present
    const pincodeMatch = text.match(/\d{6}/);
    const pincode = pincodeMatch ? pincodeMatch[0] : '';

    // Extract city if present (simple heuristic)
    const cityMatch = text.match(/(?:in|at|near)\s+([A-Za-z\s]+)/i);
    const city = cityMatch ? cityMatch[1].trim() : '';

    if (pincode && city) {
      const result = await searchNearestFlorists(city, pincode);
      return {
        text: formatMemberList(result.members, `near ${pincode}, ${city}`),
        category: 'member',
        source: result.source,
      };
    }
  }

  // Name-based search
  const nameMatch = text.match(/(?:find|search|contact|details of|give me)\s+(.+)/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    const result = await searchMembersByName(name);
    return {
      text: formatMemberList(result.members, `matching "${name}"`),
      category: 'member',
      source: result.source,
    };
  }

  // City-based search
  const cityMatch = text.match(/(?:in|at|near)\s+([A-Za-z\s]+)/i);
  if (cityMatch) {
    const city = cityMatch[1].trim();
    const result = await searchMembersByCity(city);
    return {
      text: formatMemberList(result.members, `in ${city}`),
      category: 'member',
      source: result.source,
    };
  }

  // Fallback: no specific criteria
  return {
    text: 'Please provide a name, city, or PIN code to search for IFA members.',
    category: 'member',
    source: 'none',
  };
}

/**
 * Handle leadership queries.
 */
async function handleLeadershipQuery(text: string): Promise<IfaKnowledgeContext> {
  const lower = text.toLowerCase();

  // President query
  if (lower.includes('president')) {
    const { name: presidentName, isStale } = await getPresident();
    if (!presidentName) {
      return {
        text: 'IFA President information is not currently available. Please check the IFA website for the latest leadership details.',
        category: 'leadership',
        source: 'none',
      };
    }
    return {
      text: `The current IFA President is ${presidentName}.`,
      category: 'leadership',
      source: 'website',
    };
  }

  // Specific leader by name
  const nameMatch = text.match(/(?:who is)\s+(.+)/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    const leader = await getLeaderByName(name);
    if (leader) {
      return {
        text: `${leader.name} — ${leader.role}`,
        category: 'leadership',
        source: 'website',
      };
    }
    return {
      text: `I don't have information about "${name}" in the IFA leadership records.`,
      category: 'leadership',
      source: 'none',
    };
  }

  // General leadership
  const { leaders, isStale } = await getIfaLeadership();
  if (leaders.length === 0) {
    return {
      text: 'IFA leadership information is not currently available. Please check the IFA website for the latest leadership details.',
      category: 'leadership',
      source: 'none',
    };
  }

  const leaderList = leaders.slice(0, 10).map((l) => `${l.name} — ${l.role}`).join('\n');
  return {
    text: `IFA Leadership:\n\n${leaderList}\n\nFull leadership details: https://ifaflorist.com/leadership`,
    category: 'leadership',
    source: 'website',
  };
}

/**
 * Handle events queries.
 */
async function handleEventsQuery(text: string): Promise<IfaKnowledgeContext> {
  const lower = text.toLowerCase();

  // Exhibition query
  if (lower.includes('exhibition') || lower.includes('stall') || lower.includes('sponsor')) {
    const exhibition = await getExhibitionInfo();
    if (exhibition) {
      const parts: string[] = [`IFA Exhibition ${exhibition.date}`];
      parts.push(`Venue: ${exhibition.venue}`);
      if (exhibition.packages && exhibition.packages.length > 0) {
        parts.push(`\nPackages:\n${exhibition.packages.map((p) => `- Type ${p.type}: ${p.price}`).join('\n')}`);
      }
      if (exhibition.accommodation) {
        parts.push(`Venue Accommodation: ${exhibition.accommodation}`);
      }
      return {
        text: parts.join('\n'),
        category: 'events',
        source: 'website',
      };
    }
    return {
      text: 'Exhibition information is not currently available. Please check the IFA website.',
      category: 'events',
      source: 'none',
    };
  }

  // Next meet
  if (lower.includes('next') || lower.includes('upcoming')) {
    const nextMeet = await getNextIfaMeet();
    if (nextMeet) {
      const parts: string[] = [nextMeet.name];
      if (nextMeet.date) parts.push(`Date: ${nextMeet.date}`);
      if (nextMeet.venue) parts.push(`Venue: ${nextMeet.venue}`);
      if (nextMeet.registrationFee) parts.push(`Registration: ${nextMeet.registrationFee}`);
      if (nextMeet.registrationUrl) parts.push(`Register: ${nextMeet.registrationUrl}`);
      return {
        text: parts.join('\n'),
        category: 'events',
        source: 'website',
      };
    }
    // Check for past events
    const pastMeets = await getPastIfaMeets();
    if (pastMeets.length > 0) {
      const lastMeet = pastMeets[0];
      return {
        text: `No upcoming IFA Meet is currently scheduled. The most recent IFA Meet was ${lastMeet.name} (${lastMeet.date}) at ${lastMeet.venue}. Please check the IFA website for updates on future events.`,
        category: 'events',
        source: 'website',
      };
    }
    return {
      text: 'No upcoming IFA Meet is currently scheduled. Please check the IFA website for updates.',
      category: 'events',
      source: 'none',
    };
  }

  // Registration fee query
  if (lower.includes('registration') || lower.includes('fee') || lower.includes('how much')) {
    const nextMeet = await getNextIfaMeet();
    if (nextMeet && nextMeet.registrationFee) {
      return {
        text: `IFA Meet registration starts from ${nextMeet.registrationFee}. Packages include delegate registration, meals, and IFA Year Book listing. Register at ${nextMeet.registrationUrl}`,
        category: 'events',
        source: 'website',
      };
    }
  }

  // General events
  const events = await getIfaEvents();
  if (events.length === 0) {
    return {
      text: 'IFA event information is not currently available. Please check the IFA website for upcoming events.',
      category: 'events',
      source: 'none',
    };
  }

  const eventList = events
    .slice(0, 5)
    .map((e) => `${e.name}${e.date ? ` — ${e.date}` : ''}${e.venue ? ` — ${e.venue}` : ''}`)
    .join('\n');
  return {
    text: `IFA Events:\n\n${eventList}\n\nDetails: https://ifaflorist.com/ifa-meet`,
    category: 'events',
    source: 'website',
  };
}

/**
 * Handle membership queries.
 */
async function handleMembershipQuery(text: string): Promise<IfaKnowledgeContext> {
  const info = await getIfaMembershipInfo();
  const lower = text.toLowerCase();

  // Fee query
  if (lower.includes('fee') || lower.includes('how much') || lower.includes('cost') || lower.includes('price')) {
    return {
      text: `Annual IFA membership fee is ${info.annualFee}. Join at ${info.joinUrl}`,
      category: 'membership',
      source: 'website',
    };
  }

  // Benefits query
  if (lower.includes('benefit')) {
    const benefitsText = info.benefits && info.benefits.length > 0
      ? info.benefits.map((b) => `- ${b}`).join('\n')
      : 'Promotion, networking, recognition, business growth, industry support, and events.';
    return {
      text: `IFA Membership Benefits:\n\n${benefitsText}`,
      category: 'membership',
      source: 'website',
    };
  }

  // Eligibility query
  if (lower.includes('eligible') || lower.includes('who can join')) {
    const categoriesText = info.eligibleCategories && info.eligibleCategories.length > 0
      ? info.eligibleCategories.join(', ')
      : 'Retail florists, wholesalers, flower growers, floral designers, event florists, wedding decorators, suppliers, and entrepreneurs.';
    return {
      text: `IFA membership is open to: ${categoriesText}`,
      category: 'membership',
      source: 'website',
    };
  }

  // Join query
  if (lower.includes('join') || lower.includes('how to join')) {
    return {
      text: `To join IFA, visit ${info.joinUrl} and complete the membership form. Annual membership fee is ${info.annualFee}.`,
      category: 'membership',
      source: 'website',
    };
  }

  // General membership info
  const parts: string[] = [];
  if (info.annualFee) parts.push(`Annual membership fee: ${info.annualFee}`);
  if (info.eligibleCategories && info.eligibleCategories.length > 0) {
    parts.push(`Eligible: ${info.eligibleCategories.join(', ')}`);
  }
  if (info.benefits && info.benefits.length > 0) {
    parts.push(`Benefits:\n${info.benefits.map((b) => `- ${b}`).join('\n')}`);
  }
  if (info.joinUrl) parts.push(`Join: ${info.joinUrl}`);

  if (parts.length === 0) {
    return {
      text: 'IFA membership information is not currently available. Please visit the IFA website for details.',
      category: 'membership',
      source: 'none',
    };
  }

  return {
    text: parts.join('\n'),
    category: 'membership',
    source: 'website',
  };
}

/**
 * Handle general IFA information queries.
 */
async function handleGeneralQuery(text: string): Promise<IfaKnowledgeContext> {
  const info = await getIfaGeneralInfo();
  const lower = text.toLowerCase();

  // What is IFA query
  if (lower.includes('what is') || lower.includes('about ifa')) {
    return {
      text: `${info.description || 'India Florist Association (IFA) is India\'s leading floral industry organization.'}\n\nFounded: ${info.founded}\nMission: ${info.mission}\nVision: ${info.vision}\n\nWebsite: ${info.website}`,
      category: 'general',
      source: 'website',
    };
  }

  // Contact query
  if (lower.includes('contact') || lower.includes('email') || lower.includes('phone') || lower.includes('address')) {
    const parts: string[] = [];
    if (info.contactEmail) parts.push(`Email: ${info.contactEmail}`);
    if (info.contactPhone) parts.push(`Phone: ${info.contactPhone}`);
    if (info.address) parts.push(`Address: ${info.address}`);
    if (info.website) parts.push(`Website: ${info.website}`);
    return {
      text: parts.join('\n'),
      category: 'general',
      source: 'website',
    };
  }

  // General info
  const parts: string[] = [];
  if (info.founded) parts.push(`Founded: ${info.founded}`);
  if (info.mission) parts.push(`Mission: ${info.mission}`);
  if (info.vision) parts.push(`Vision: ${info.vision}`);
  if (info.contactEmail) parts.push(`Email: ${info.contactEmail}`);
  if (info.contactPhone) parts.push(`Phone: ${info.contactPhone}`);
  if (info.website) parts.push(`Website: ${info.website}`);

  if (parts.length === 0) {
    return {
      text: 'IFA general information is not currently available. Please visit the IFA website for details.',
      category: 'general',
      source: 'none',
    };
  }

  return {
    text: parts.join('\n'),
    category: 'general',
    source: 'website',
  };
}

/**
 * Main entry point: resolve a query to knowledge context.
 */
export async function resolveIfaKnowledge(
  query: IfaQuery
): Promise<IfaKnowledgeContext> {
  const category = query.category || detectQueryCategory(query.text);

  switch (category) {
    case 'member':
      return handleMemberQuery(query.text);
    case 'leadership':
      return handleLeadershipQuery(query.text);
    case 'events':
      return handleEventsQuery(query.text);
    case 'membership':
      return handleMembershipQuery(query.text);
    case 'general':
      return handleGeneralQuery(query.text);
    default:
      return {
        text: 'I can help with IFA membership, member search, events, leadership, and general information. What would you like to know?',
        category: 'general',
        source: 'none',
      };
  }
}

/**
 * Get contact details for a specific member (for follow-up queries).
 */
export async function getMemberContact(
  memberName: string,
  recentMembers: IfaMember[]
): Promise<string> {
  // First check recent results
  const normalized = memberName.toLowerCase().trim();
  const recentMatch = recentMembers.find(
    (m) => m.businessName.toLowerCase().includes(normalized) || normalized.includes(m.businessName.toLowerCase())
  );

  if (recentMatch) {
    return formatMemberContact(recentMatch);
  }

  // Otherwise search by name
  const result = await searchMembersByName(memberName);
  if (result.members.length > 0) {
    return formatMemberContact(result.members[0]);
  }

  return `Sorry, I couldn't find member details for "${memberName}".`;
}
