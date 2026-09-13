/**
 * IFA member search.
 *
 * Sources:
 * 1. Database business_profiles table (primary)
 * 2. Floritribe API (for location-based searches)
 */

import pool from '@/lib/db';
import { getNearestFlorists, type FloritribeFlorist } from '@/lib/floritribeLocator';
import type { IfaMember } from './types';

export interface MemberSearchResult {
  members: IfaMember[];
  source: 'database' | 'floritribe';
}

/**
 * Search members by name (database).
 */
export async function searchMembersByName(query: string): Promise<MemberSearchResult> {
  const normalizedQuery = `%${query.trim().toLowerCase()}%`;

  const result = await pool.query<IfaMember>(
    `SELECT
      member_id as "memberId",
      business_name as "businessName",
      address,
      phone_numbers as "phone",
      website,
      instagram,
      google_maps_url as "googleMapsUrl"
     FROM business_profiles
     WHERE business_name ILIKE $1
     LIMIT 10`,
    [normalizedQuery]
  );

  return {
    members: result.rows,
    source: 'database',
  };
}

/**
 * Search members by city (database).
 */
export async function searchMembersByCity(city: string): Promise<MemberSearchResult> {
  const normalizedCity = `%${city.trim().toLowerCase()}%`;

  const result = await pool.query<IfaMember>(
    `SELECT
      member_id as "memberId",
      business_name as "businessName",
      address,
      phone_numbers as "phone",
      website,
      instagram,
      google_maps_url as "googleMapsUrl"
     FROM business_profiles
     WHERE address ILIKE $1
     LIMIT 20`,
    [normalizedCity]
  );

  return {
    members: result.rows,
    source: 'database',
  };
}

/**
 * Search members by pincode (database).
 */
export async function searchMembersByPincode(pincode: string): Promise<MemberSearchResult> {
  const normalizedPincode = pincode.trim();

  const result = await pool.query<IfaMember>(
    `SELECT
      member_id as "memberId",
      business_name as "businessName",
      address,
      phone_numbers as "phone",
      website,
      instagram,
      google_maps_url as "googleMapsUrl"
     FROM business_profiles
     WHERE address ILIKE $1
     LIMIT 20`,
    [`%${normalizedPincode}%`]
  );

  return {
    members: result.rows,
    source: 'database',
  };
}

/**
 * Get member by ID (database).
 */
export async function getMemberById(memberId: number): Promise<IfaMember | null> {
  const result = await pool.query<IfaMember>(
    `SELECT
      member_id as "memberId",
      business_name as "businessName",
      address,
      phone_numbers as "phone",
      website,
      instagram,
      google_maps_url as "googleMapsUrl"
     FROM business_profiles
     WHERE member_id = $1
     LIMIT 1`,
    [memberId]
  );

  return result.rowCount === 1 ? result.rows[0] : null;
}

/**
 * Search nearest IFA florists via Floritribe API.
 * Reuses the existing locator infrastructure.
 * memberId is optional for Floritribe results - preserve all available fields.
 */
export async function searchNearestFlorists(
  city: string,
  pincode: string,
  limit = 3
): Promise<MemberSearchResult> {
  const florists = await getNearestFlorists({ city, pincode, limit });

  const members: IfaMember[] = florists.map((f) => ({
    memberId: f.memberId, // Optional - can be undefined for Floritribe results
    businessName: f.name,
    address: f.address,
    pincode: f.pincode,
    phone: f.phone,
    businessType: f.businessType,
    googleMapsUrl: f.slug ? `https://floritribe.com/florist/${f.slug}` : undefined,
  }));

  return {
    members,
    source: 'floritribe',
  };
}

/**
 * Format member list for WhatsApp.
 */
export function formatMemberList(members: IfaMember[], context: string): string {
  if (members.length === 0) {
    return `Sorry 😊 I couldn't find any IFA members ${context}. Would you like me to search with different criteria?`;
  }

  const header = `IFA members ${context}:\n\n`;
  const lines = members.slice(0, 5).map((m, i) => {
    const parts: string[] = [`${i + 1}. ${m.businessName}`];
    if (m.address) parts.push(`   ${m.address}`);
    if (m.phone) parts.push(`   📞 ${m.phone}`);
    return parts.join('\n');
  });

  return header + lines.join('\n') + '\n\nWould you like contact details for any of these?';
}

/**
 * Format single member contact details.
 */
export function formatMemberContact(member: IfaMember): string {
  const lines: string[] = [member.businessName];

  if (member.address) {
    lines.push(`📍 ${member.address}`);
  } else {
    lines.push('📍 Address not available');
  }

  if (member.phone) {
    lines.push(`📞 ${member.phone}`);
  } else {
    lines.push('📞 Phone number not available');
  }

  if (member.website) {
    lines.push(`🌐 ${member.website}`);
  }

  if (member.instagram) {
    lines.push(`📸 ${member.instagram}`);
  }

  return lines.join('\n');
}
