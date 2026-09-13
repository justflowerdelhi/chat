/**
 * IFA leadership knowledge source.
 *
 * Fetches real data from the IFA website.
 */

import { fetchIfaLeadership } from './sources';
import type { IfaLeader } from './types';

/**
 * Get IFA leadership information from the official website.
 */
export async function getIfaLeadership(): Promise<{ leaders: IfaLeader[]; isStale: boolean }> {
  const data = await fetchIfaLeadership();
  const leaders: IfaLeader[] = [];

  // Core leadership
  if (data.president) leaders.push({ name: data.president, role: 'President' });
  if (data.vicePresident) leaders.push({ name: data.vicePresident, role: 'Vice President' });
  if (data.secretary) leaders.push({ name: data.secretary, role: 'Secretary' });
  if (data.treasurer) leaders.push({ name: data.treasurer, role: 'Treasurer' });

  // Office bearers
  data.officeBearers.forEach((bearer) => {
    leaders.push({ name: bearer.name, role: bearer.role });
  });

  return { leaders, isStale: data.isStale };
}

/**
 * Get a specific leader by name.
 */
export async function getLeaderByName(name: string): Promise<IfaLeader | null> {
  const { leaders } = await getIfaLeadership();
  const normalized = name.toLowerCase().trim();
  return (
    leaders.find(
      (l) => l.name.toLowerCase().includes(normalized) || normalized.includes(l.name.toLowerCase())
    ) || null
  );
}

/**
 * Get the current president.
 */
export async function getPresident(): Promise<{ name: string; isStale: boolean }> {
  const data = await fetchIfaLeadership();
  return { name: data.president, isStale: data.isStale };
}
