/**
 * IFA membership knowledge source.
 *
 * Fetches real data from the IFA website.
 */

import { fetchIfaMembershipInfo } from './sources';
import type { IfaMembershipInfo } from './types';

/**
 * Get IFA membership information from the official website.
 */
export async function getIfaMembershipInfo(): Promise<IfaMembershipInfo & { isStale: boolean }> {
  const data = await fetchIfaMembershipInfo();
  return {
    annualFee: data.annualFee,
    eligibleCategories: data.eligibleCategories,
    joinUrl: data.joinUrl,
    benefits: data.benefits,
    isStale: data.isStale,
  };
}
