/**
 * IFA knowledge layer types.
 */

export interface IfaMember {
  memberId?: number; // Optional for Floritribe results
  businessName: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  businessType?: string;
  membershipStatus?: string;
  googleMapsUrl?: string;
}

export interface IfaLeader {
  name: string;
  role: string;
  title?: string;
  since?: string;
}

export interface IfaEvent {
  name: string;
  date?: string;
  venue?: string;
  registrationUrl?: string;
  registrationFee?: string;
  description?: string;
}

export interface IfaMembershipInfo {
  annualFee?: string;
  eligibleCategories?: string[];
  joinUrl?: string;
  benefits?: string[];
}

export interface IfaGeneralInfo {
  founded?: string;
  mission?: string;
  vision?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  website?: string;
}

export type IfaKnowledgeCategory =
  | 'member'
  | 'leadership'
  | 'events'
  | 'membership'
  | 'general';

export interface IfaKnowledgeResult {
  category: IfaKnowledgeCategory;
  data: unknown;
  source: string;
  cachedAt?: string;
}
