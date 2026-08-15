import pool from '@/lib/db';

export interface BusinessProfile {
  id: string;
  member_id: number;
  business_name: string | null;
  tagline: string | null;
  description: string | null;
  address: string | null;
  google_maps_url: string | null;
  working_hours: string | null;
  delivery_areas: string | null;
  delivery_charges: string | null;
  emergency_delivery: boolean;
  midnight_delivery: boolean;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  upi_id: string | null;
  gst_number: string | null;
  phone_numbers: string | null;
  email: string | null;
  cancellation_policy: string | null;
  refund_policy: string | null;
  customization_policy: string | null;
  greeting_message: string | null;
  closing_message: string | null;
}

export interface FAQ {
  id: string;
  member_id: number;
  question: string;
  answer: string;
  category: string;
  priority: number;
}

export interface CatalogProduct {
  id: string;
  member_id: number;
  name: string;
  price: number | null;
  description: string | null;
  occasion: string | null;
  flower_types: string | null;
  color: string | null;
  style: string | null;
  image_url: string | null;
  availability: boolean;
  featured: boolean;
  premium: boolean;
  luxury: boolean;
  budget: boolean;
  same_day: boolean;
  categories: string | null;
  source?: 'design_gallery' | 'manual_catalog';
}

export interface DesignGalleryProduct extends CatalogProduct {
  external_id: string | null;
  synced_at: string | null;
}

export interface CustomerProfile {
  id: string;
  member_id: number;
  phone: string;
  name: string | null;
  preferences: string | null;
  favourite_flowers: string | null;
  favourite_colours: string | null;
  occasions: string | null;
  budget: string | null;
  delivery_address: string | null;
  last_purchase: string | null;
  open_quote: string | null;
  last_ai_summary: string | null;
}

export interface AISettings {
  id: string;
  member_id: number;
  temperature: number;
  model: string;
  creativity: 'conservative' | 'balanced' | 'creative';
  greeting: string | null;
  language: string;
  emoji_level: 'none' | 'low' | 'medium' | 'high';
  max_reply_length: number;
  quote_style: string;
}

export async function getBusinessProfile(memberId: number): Promise<BusinessProfile | null> {
  const result = await pool.query<BusinessProfile>(
    'SELECT * FROM business_profiles WHERE member_id = $1 LIMIT 1',
    [memberId]
  );
  return result.rowCount === 1 ? result.rows[0] : null;
}

export async function getFAQs(memberId: number, category?: string): Promise<FAQ[]> {
  if (category) {
    const result = await pool.query<FAQ>(
      'SELECT * FROM faqs WHERE member_id = $1 AND category = $2 ORDER BY priority DESC, created_at ASC',
      [memberId, category]
    );
    return result.rows;
  }

  const result = await pool.query<FAQ>(
    'SELECT * FROM faqs WHERE member_id = $1 ORDER BY priority DESC, created_at ASC',
    [memberId]
  );
  return result.rows;
}

export async function getCatalogProducts(
  memberId: number,
  options: { featured?: boolean; limit?: number } = {}
): Promise<CatalogProduct[]> {
  const limit = options.limit ?? 50;

  if (options.featured) {
    const result = await pool.query<CatalogProduct>(
      'SELECT * FROM catalog_products WHERE member_id = $1 AND featured = true AND availability = true ORDER BY created_at DESC LIMIT $2',
      [memberId, limit]
    );
    return result.rows;
  }

  const result = await pool.query<CatalogProduct>(
    'SELECT * FROM catalog_products WHERE member_id = $1 AND availability = true ORDER BY featured DESC, created_at DESC LIMIT $2',
    [memberId, limit]
  );
  return result.rows;
}

export async function getCatalogSource(memberId: number): Promise<{ source: 'design_gallery' | 'manual_catalog'; status: string; connected_at: string | null; last_synced_at: string | null }> {
  const result = await pool.query<{ source: 'design_gallery' | 'manual_catalog'; status: string; connected_at: string | null; last_synced_at: string | null }>(
    'SELECT source, status, connected_at, last_synced_at FROM catalog_sources WHERE member_id = $1 LIMIT 1',
    [memberId]
  );
  if (result.rowCount === 0) {
    return { source: 'manual_catalog', status: 'not_connected', connected_at: null, last_synced_at: null };
  }
  return result.rows[0];
}

export async function getDesignGalleryProducts(
  memberId: number,
  options: { featured?: boolean; limit?: number } = {}
): Promise<DesignGalleryProduct[]> {
  const limit = options.limit ?? 50;

  if (options.featured) {
    const result = await pool.query<DesignGalleryProduct>(
      'SELECT *, \'design_gallery\' as source FROM design_gallery WHERE member_id = $1 AND featured = true AND availability = true ORDER BY updated_at DESC LIMIT $2',
      [memberId, limit]
    );
    return result.rows;
  }

  const result = await pool.query<DesignGalleryProduct>(
    'SELECT *, \'design_gallery\' as source FROM design_gallery WHERE member_id = $1 AND availability = true ORDER BY featured DESC, updated_at DESC LIMIT $2',
    [memberId, limit]
  );
  return result.rows;
}

export async function getUnifiedCatalogProducts(
  memberId: number,
  options: { featured?: boolean; limit?: number } = {}
): Promise<CatalogProduct[]> {
  const source = await getCatalogSource(memberId);
  const design = await getDesignGalleryProducts(memberId, options);

  if (design.length > 0) {
    return design.map((product) => ({ ...product, source: 'design_gallery' as const }));
  }

  if (source.source === 'design_gallery' && design.length === 0) {
    // Design gallery is selected but empty; fall back to manual catalog.
    const manual = await getCatalogProducts(memberId, options);
    return manual.map((product) => ({ ...product, source: 'manual_catalog' as const }));
  }

  if (source.source === 'manual_catalog') {
    const manual = await getCatalogProducts(memberId, options);
    return manual.map((product) => ({ ...product, source: 'manual_catalog' as const }));
  }

  return design.map((product) => ({ ...product, source: 'design_gallery' as const }));
}

export async function getCustomerProfile(memberId: number, phone: string): Promise<CustomerProfile | null> {
  const result = await pool.query<CustomerProfile>(
    'SELECT * FROM customer_profiles WHERE member_id = $1 AND phone = $2 LIMIT 1',
    [memberId, phone]
  );
  return result.rowCount === 1 ? result.rows[0] : null;
}

export async function upsertCustomerProfile(
  memberId: number,
  phone: string,
  updates: Partial<CustomerProfile>
): Promise<CustomerProfile> {
  const result = await pool.query<CustomerProfile>(
    `INSERT INTO customer_profiles (
      member_id, phone, name, preferences, favourite_flowers, favourite_colours,
      occasions, budget, delivery_address, last_purchase, open_quote, last_ai_summary
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (member_id, phone) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, customer_profiles.name),
      preferences = COALESCE(EXCLUDED.preferences, customer_profiles.preferences),
      favourite_flowers = COALESCE(EXCLUDED.favourite_flowers, customer_profiles.favourite_flowers),
      favourite_colours = COALESCE(EXCLUDED.favourite_colours, customer_profiles.favourite_colours),
      occasions = COALESCE(EXCLUDED.occasions, customer_profiles.occasions),
      budget = COALESCE(EXCLUDED.budget, customer_profiles.budget),
      delivery_address = COALESCE(EXCLUDED.delivery_address, customer_profiles.delivery_address),
      last_purchase = COALESCE(EXCLUDED.last_purchase, customer_profiles.last_purchase),
      open_quote = COALESCE(EXCLUDED.open_quote, customer_profiles.open_quote),
      last_ai_summary = COALESCE(EXCLUDED.last_ai_summary, customer_profiles.last_ai_summary),
      updated_at = NOW()
    RETURNING *`,
    [
      memberId,
      phone,
      updates.name ?? null,
      updates.preferences ?? null,
      updates.favourite_flowers ?? null,
      updates.favourite_colours ?? null,
      updates.occasions ?? null,
      updates.budget ?? null,
      updates.delivery_address ?? null,
      updates.last_purchase ?? null,
      updates.open_quote ?? null,
      updates.last_ai_summary ?? null,
    ]
  );
  return result.rows[0];
}

export async function getAISettings(memberId: number): Promise<AISettings | null> {
  const result = await pool.query<AISettings>(
    'SELECT * FROM ai_settings WHERE member_id = $1 LIMIT 1',
    [memberId]
  );
  return result.rowCount === 1 ? result.rows[0] : null;
}
