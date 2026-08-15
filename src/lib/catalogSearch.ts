import pool from '@/lib/db';

export interface CatalogProduct {
  id: string;
  member_id: number;
  source?: 'design_gallery' | 'manual_catalog';
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
}

const IMAGE_KEYWORDS = [
  'show', 'dikhao', 'dikha', 'photo', 'image', 'picture', 'pic',
  'bouquet', 'flowers', 'arrangement', 'basket', 'roses', 'orchids',
  'lilies', 'carnations', 'gerbera', 'tulips', 'sunflower', 'mixed',
  'anniversary', 'birthday', 'love', 'wedding', 'funeral', 'congratulations',
  'get well', 'mothers day', 'valentine', 'premium', 'luxury', 'budget',
  'red', 'pink', 'white', 'yellow', 'orange', 'purple', 'blue', 'pastel',
];

function hasImageIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return IMAGE_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function extractRelevantTerms(message: string): string[] {
  const lower = message.toLowerCase();
  return IMAGE_KEYWORDS.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

export function shouldRecommendImages(message: string): boolean {
  return hasImageIntent(message);
}

const CATALOG_COLUMNS = `
  id, member_id, name, price, description, occasion, flower_types, color, style, image_url,
  availability, featured, premium, luxury, budget, same_day, categories
`;

async function searchDesignGallery(
  memberId: number,
  terms: string[],
  limit: number
): Promise<CatalogProduct[]> {
  if (terms.length === 0) {
    const result = await pool.query<CatalogProduct>(
      `SELECT ${CATALOG_COLUMNS}, 'design_gallery' as source
       FROM design_gallery
       WHERE member_id = $1 AND availability = true AND image_url IS NOT NULL
       ORDER BY featured DESC, updated_at DESC
       LIMIT $2`,
      [memberId, limit]
    );
    return result.rows;
  }

  const conditions = terms
    .map((_, index) => `(
      (name || ' ' || COALESCE(occasion, '') || ' ' || COALESCE(categories, '') || ' ' || COALESCE(flower_types, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(color, '') || ' ' || COALESCE(style, ''))
      ILIKE $${index + 3}
    )`)
    .join(' OR ');

  const values: string[] = terms.map((term) => `%${term}%`);

  const result = await pool.query<CatalogProduct>(
    `SELECT ${CATALOG_COLUMNS}, 'design_gallery' as source
     FROM design_gallery
     WHERE member_id = $1 AND availability = true AND image_url IS NOT NULL
     AND (${conditions})
     ORDER BY featured DESC, updated_at DESC
     LIMIT $2`,
    [memberId, limit, ...values]
  );

  if (result.rows.length === 0) {
    const fallback = await pool.query<CatalogProduct>(
      `SELECT ${CATALOG_COLUMNS}, 'design_gallery' as source
       FROM design_gallery
       WHERE member_id = $1 AND availability = true AND image_url IS NOT NULL
       ORDER BY featured DESC, updated_at DESC
       LIMIT $2`,
      [memberId, limit]
    );
    return fallback.rows;
  }

  return result.rows;
}

async function searchManualCatalog(
  memberId: number,
  terms: string[],
  limit: number
): Promise<CatalogProduct[]> {
  if (terms.length === 0) {
    const result = await pool.query<CatalogProduct>(
      `SELECT ${CATALOG_COLUMNS}, 'manual_catalog' as source
       FROM catalog_products
       WHERE member_id = $1 AND availability = true AND image_url IS NOT NULL
       ORDER BY featured DESC, created_at DESC
       LIMIT $2`,
      [memberId, limit]
    );
    return result.rows;
  }

  const conditions = terms
    .map((_, index) => `(
      (name || ' ' || COALESCE(occasion, '') || ' ' || COALESCE(categories, '') || ' ' || COALESCE(flower_types, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(color, '') || ' ' || COALESCE(style, ''))
      ILIKE $${index + 3}
    )`)
    .join(' OR ');

  const values: string[] = terms.map((term) => `%${term}%`);

  const result = await pool.query<CatalogProduct>(
    `SELECT ${CATALOG_COLUMNS}, 'manual_catalog' as source
     FROM catalog_products
     WHERE member_id = $1 AND availability = true AND image_url IS NOT NULL
     AND (${conditions})
     ORDER BY featured DESC, created_at DESC
     LIMIT $2`,
    [memberId, limit, ...values]
  );

  if (result.rows.length === 0) {
    const fallback = await pool.query<CatalogProduct>(
      `SELECT ${CATALOG_COLUMNS}, 'manual_catalog' as source
       FROM catalog_products
       WHERE member_id = $1 AND availability = true AND image_url IS NOT NULL
       ORDER BY featured DESC, created_at DESC
       LIMIT $2`,
      [memberId, limit]
    );
    return fallback.rows;
  }

  return result.rows;
}

export async function recommendCatalogImages(
  memberId: number,
  message: string,
  limit = 5
): Promise<CatalogProduct[]> {
  const terms = extractRelevantTerms(message);

  // 1. Try the Floraprise Design Gallery first.
  const designGallery = await searchDesignGallery(memberId, terms, limit);
  if (designGallery.length > 0) {
    return designGallery;
  }

  // 2. Fall back to the manual catalog.
  const manual = await searchManualCatalog(memberId, terms, limit);
  return manual;
}
