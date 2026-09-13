/**
 * IFA events knowledge source.
 *
 * Fetches real data from the IFA website.
 */

import { fetchIfaEvents } from './sources';
import type { IfaEvent } from './types';

/**
 * Parse a date string like "18th - 19th August 2026" or "18–19 August 2026" to a Date object.
 */
function parseEventDate(dateStr: string): Date | null {
  try {
    // Handle various date formats
    const normalized = dateStr.replace(/–/g, '-').replace(/st|nd|rd|th/g, '').trim();
    // Try parsing with Date
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if an event date is in the future (relative to current date).
 */
function isEventFuture(dateStr: string): boolean {
  const eventDate = parseEventDate(dateStr);
  if (!eventDate) return false; // If we can't parse, assume not future
  return eventDate > new Date();
}

/**
 * Get IFA events (upcoming and recent) from the official website.
 */
export async function getIfaEvents(): Promise<IfaEvent[]> {
  const data = await fetchIfaEvents();
  const events: IfaEvent[] = [];

  if (data.upcomingEvent && isEventFuture(data.upcomingEvent.date)) {
    events.push({
      name: data.upcomingEvent.name,
      date: data.upcomingEvent.date,
      venue: data.upcomingEvent.venue,
      registrationUrl: data.upcomingEvent.registrationUrl,
      registrationFee: data.upcomingEvent.registrationFee,
      description: `Registration packages available from ${data.upcomingEvent.registrationFee}`,
    });
  }

  return events;
}

/**
 * Get the next IFA Meet (only if it's in the future).
 */
export async function getNextIfaMeet(): Promise<IfaEvent | null> {
  const data = await fetchIfaEvents();
  if (data.upcomingEvent && isEventFuture(data.upcomingEvent.date)) {
    return {
      name: data.upcomingEvent.name,
      date: data.upcomingEvent.date,
      venue: data.upcomingEvent.venue,
      registrationUrl: data.upcomingEvent.registrationUrl,
      registrationFee: data.upcomingEvent.registrationFee,
      description: `Registration packages available from ${data.upcomingEvent.registrationFee}`,
    };
  }
  return null;
}

/**
 * Get exhibition information.
 */
export async function getExhibitionInfo(): Promise<{
  date: string;
  venue: string;
  packages: Array<{ type: string; size: string; price: string; inclusions: string[] }>;
  accommodation: string;
  isStale: boolean;
} | null> {
  const data = await fetchIfaEvents();
  if (data.exhibition) {
    return { ...data.exhibition, isStale: data.isStale };
  }
  return null;
}

/**
 * Get past IFA Meets.
 * Currently no past event data available on the website.
 */
export async function getPastIfaMeets(): Promise<IfaEvent[]> {
  const data = await fetchIfaEvents();
  const pastEvents: IfaEvent[] = [];

  // If the website has an event that's in the past, include it
  if (data.upcomingEvent && !isEventFuture(data.upcomingEvent.date)) {
    pastEvents.push({
      name: data.upcomingEvent.name,
      date: data.upcomingEvent.date,
      venue: data.upcomingEvent.venue,
      registrationUrl: data.upcomingEvent.registrationUrl,
      registrationFee: data.upcomingEvent.registrationFee,
      description: `Registration packages were available from ${data.upcomingEvent.registrationFee}`,
    });
  }

  return pastEvents;
}
