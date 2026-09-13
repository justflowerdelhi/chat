/**
 * IFA general information knowledge source.
 *
 * Fetches real data from the IFA website.
 */

import { fetchIfaGeneralInfo } from './sources';
import type { IfaGeneralInfo } from './types';

/**
 * Get IFA general information from the official website.
 */
export async function getIfaGeneralInfo(): Promise<IfaGeneralInfo & { isStale: boolean }> {
  const data = await fetchIfaGeneralInfo();
  return {
    founded: data.founded,
    mission: data.mission,
    vision: data.vision,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    website: data.website,
    isStale: data.isStale,
  };
}
