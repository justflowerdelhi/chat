import pool from './db';
import { login, get, getCompanyId, refresh, FlorapriseApiError, FlorapriseAuth } from './florapriseApi';

export interface SyncResult {
  ok: boolean;
  status: 'synced' | 'missing_credentials' | 'company_mismatch' | 'no_data' | 'error';
  message: string;
  found?: number;
  availableOnline?: number;
  new?: number;
  updated?: number;
  unavailable?: number;
  last_synced_at?: string;
}

interface MappedDesign {
  external_id: string;
  name: string;
  price: number | null;
  description: string | null;
  occasion: string | null;
  flower_types: string | null;
  color: string | null;
  style: string | null;
  image_url: string | null;
  availability: boolean;
  categories: string | null;
  synced_at: string;
}

function toDecimal(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  return null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'True' || value === '1' || value === 1) return true;
  return false;
}

function extractItems(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    return (
      (Array.isArray(obj.data) ? (obj.data as unknown[]) : undefined) ??
      (Array.isArray(obj.items) ? (obj.items as unknown[]) : undefined) ??
      (Array.isArray(obj.results) ? (obj.results as unknown[]) : undefined) ??
      (Array.isArray(obj.products) ? (obj.products as unknown[]) : undefined) ??
      (Array.isArray(obj.records) ? (obj.records as unknown[]) : undefined) ??
      []
    );
  }
  return [];
}

async function getAuthenticated(
  path: string,
  auth: FlorapriseAuth
): Promise<unknown> {
  try {
    return await get(path, auth.accessToken);
  } catch (e) {
    if (auth.refreshToken && e instanceof FlorapriseApiError && e.status === 401) {
      const next = await refresh(auth.refreshToken);
      return get(path, next.accessToken);
    }
    throw e;
  }
}

async function fetchProducts(auth: FlorapriseAuth): Promise<unknown[]> {
  const pageSize = 100;
  const products: unknown[] = [];

  for (let page = 1; page <= 100; page++) {
    const res = (await getAuthenticated(
      `/api/products/search?IsActive=true&Page=${page}&PageSize=${pageSize}`,
      auth
    )) as Record<string, unknown>;

    const items = extractItems(res);
    if (!items.length) break;

    products.push(...items);

    const totalCount =
      typeof res.totalCount === 'number'
        ? res.totalCount
        : typeof res.total === 'number'
          ? res.total
          : undefined;

    if (totalCount !== undefined && products.length >= totalCount) break;
    if (items.length < pageSize) break;
  }

  return products;
}

function mapProduct(item: unknown): MappedDesign | null {
  if (!item || typeof item !== 'object') return null;
  const p = item as Record<string, unknown>;

  const externalId = String(p.id ?? p.productId ?? '');
  if (!externalId || externalId === 'undefined' || externalId === 'null') return null;

  const settings =
    p.settings && typeof p.settings === 'object' ? (p.settings as Record<string, unknown>) : {};
  const flowerAttributes =
    p.flowerAttributes && typeof p.flowerAttributes === 'object'
      ? (p.flowerAttributes as Record<string, unknown>)
      : {};

  const name = String(p.name ?? p.productName ?? '').trim() || null;
  if (!name) return null;

  const tags = Array.isArray(p.tags) ? p.tags.map(String) : [];
  const flowerAttrSeasonality = Array.isArray(flowerAttributes.seasonality)
    ? flowerAttributes.seasonality.map(String)
    : [];

  const flowerList: string[] = [];
  if (flowerAttributes.variety) flowerList.push(String(flowerAttributes.variety));
  if (flowerAttributes.color) flowerList.push(String(flowerAttributes.color));
  if (tags.length) flowerList.push(...tags);
  if (flowerAttrSeasonality.length) flowerList.push(...flowerAttrSeasonality);
  if (p.productType) flowerList.push(String(p.productType));

  const now = new Date().toISOString();

  const availability =
    settings.availableOnline !== undefined
      ? toBoolean(settings.availableOnline)
      : p.isActive !== undefined
        ? toBoolean(p.isActive)
        : p.available !== undefined
          ? toBoolean(p.available)
          : false;

  const imageUrl =
    (typeof p.image === 'string' ? p.image : undefined) ??
    (typeof p.imageUrl === 'string' ? p.imageUrl : undefined) ??
    (typeof p.image_url === 'string' ? p.image_url : undefined) ??
    (typeof p.photo === 'string' ? p.photo : undefined) ??
    (typeof p.thumbnail === 'string' ? p.thumbnail : undefined) ??
    (typeof p.primaryImage === 'string' ? p.primaryImage : undefined) ??
    null;

  const categories = Array.isArray(p.category)
    ? p.category.map(String).join(', ')
    : typeof p.category === 'string'
      ? p.category
      : typeof p.productType === 'string'
        ? p.productType
        : null;

  return {
    external_id: externalId,
    name,
    price: toDecimal(p.retailPrice ?? p.sellingPrice ?? p.unitPrice ?? p.price),
    description:
      typeof p.description === 'string' ? p.description : typeof p.shortDescription === 'string' ? p.shortDescription : null,
    occasion: typeof p.occasion === 'string' ? p.occasion : null,
    flower_types: flowerList.length ? [...new Set(flowerList)].join(', ') : null,
    color:
      typeof flowerAttributes.color === 'string'
        ? flowerAttributes.color
        : typeof p.color === 'string'
          ? p.color
          : null,
    style:
      typeof p.style === 'string'
        ? p.style
        : typeof p.shape === 'string'
          ? p.shape
          : typeof flowerAttributes.style === 'string'
            ? flowerAttributes.style
            : null,
    image_url: imageUrl,
    availability,
    categories,
    synced_at: now,
  };
}

export async function syncDesignGalleryForMember(memberId: number): Promise<SyncResult> {
  const now = new Date().toISOString();

  if (!process.env.FLORAPRISE_ERP_EMAIL || !process.env.FLORAPRISE_ERP_PASSWORD) {
    return {
      ok: false,
      status: 'missing_credentials',
      message:
        'ERP pilot credentials are not configured. Set FLORAPRISE_ERP_EMAIL and FLORAPRISE_ERP_PASSWORD.',
      found: 0,
      availableOnline: 0,
      new: 0,
      updated: 0,
      unavailable: 0,
    };
  }

  let memberRow: { external_company_id: string | null } | undefined;
  try {
    const res = await pool.query('SELECT external_company_id FROM members WHERE id = $1', [memberId]);
    memberRow = res.rows[0] as { external_company_id: string | null } | undefined;
  } catch {
    // members table might not have the column yet
  }

  let auth: FlorapriseAuth;
  try {
    auth = await login();
  } catch (e) {
    return {
      ok: false,
      status: 'error',
      message: e instanceof Error ? e.message : 'ERP login failed',
    };
  }

  let companyId = auth.companyId ?? (await getCompanyId(auth.accessToken));
  if (!companyId) {
    return {
      ok: false,
      status: 'error',
      message:
        'Could not determine ERP companyId. Set FLORAPRISE_ERP_COMPANY_ID or ensure the login returns companyId.',
    };
  }

  if (memberRow?.external_company_id) {
    if (memberRow.external_company_id.toLowerCase() !== companyId.toLowerCase()) {
      return {
        ok: false,
        status: 'company_mismatch',
        message: `ERP company ${companyId} does not match the AI mapping for member ${memberId}.`,
      };
    }
  } else {
    try {
      await pool.query('UPDATE members SET external_company_id = $1 WHERE id = $2', [
        companyId,
        memberId,
      ]);
    } catch (e) {
      console.warn('Could not persist external_company_id mapping:', e);
    }
  }

  let products: unknown[];
  try {
    products = await fetchProducts(auth);
  } catch (e) {
    return {
      ok: false,
      status: 'error',
      message: e instanceof Error ? e.message : 'Failed to fetch products',
    };
  }

  const mapped = products.map(mapProduct).filter((m): m is MappedDesign => m !== null);

  if (mapped.length === 0) {
    return {
      ok: true,
      status: 'no_data',
      message: 'No mappable products returned from ERP.',
      found: products.length,
      availableOnline: 0,
      new: 0,
      updated: 0,
      unavailable: 0,
      last_synced_at: now,
    };
  }

  const existingRes = await pool.query(
    'SELECT external_id FROM design_gallery WHERE member_id = $1',
    [memberId]
  );
  const existingIds = new Set(existingRes.rows.map((r) => String(r.external_id)));

  const newCount = mapped.filter((m) => !existingIds.has(m.external_id)).length;
  const updatedCount = mapped.length - newCount;
  const availableOnline = mapped.filter((m) => m.availability).length;

  for (const m of mapped) {
    await pool.query(
      `INSERT INTO design_gallery (
        member_id, external_id, name, price, description, occasion, flower_types, color, style,
        image_url, availability, featured, premium, luxury, budget, same_day, categories, synced_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      ON CONFLICT (member_id, external_id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        description = EXCLUDED.description,
        occasion = EXCLUDED.occasion,
        flower_types = EXCLUDED.flower_types,
        color = EXCLUDED.color,
        style = EXCLUDED.style,
        image_url = EXCLUDED.image_url,
        availability = EXCLUDED.availability,
        featured = EXCLUDED.featured,
        premium = EXCLUDED.premium,
        luxury = EXCLUDED.luxury,
        budget = EXCLUDED.budget,
        same_day = EXCLUDED.same_day,
        categories = EXCLUDED.categories,
        synced_at = EXCLUDED.synced_at,
        updated_at = NOW()`,
      [
        memberId,
        m.external_id,
        m.name,
        m.price,
        m.description,
        m.occasion,
        m.flower_types,
        m.color,
        m.style,
        m.image_url,
        m.availability,
        false,
        false,
        false,
        false,
        false,
        m.categories,
        m.synced_at,
      ]
    );
  }

  const ids = mapped.map((m) => m.external_id);
  const unavailableResult = await pool.query(
    `UPDATE design_gallery
     SET availability = false, updated_at = NOW()
     WHERE member_id = $1 AND external_id NOT IN (SELECT unnest($2::text[]))`,
    [memberId, ids]
  );

  await pool.query(
    `INSERT INTO catalog_sources (member_id, source, status, connected_at, last_synced_at)
     VALUES ($1, 'design_gallery', 'connected', $2, $2)
     ON CONFLICT (member_id) DO UPDATE SET
       source = 'design_gallery',
       status = 'connected',
       connected_at = COALESCE(catalog_sources.connected_at, EXCLUDED.connected_at),
       last_synced_at = $2,
       updated_at = NOW()`,
    [memberId, now]
  );

  return {
    ok: true,
    status: 'synced',
    message: 'Design Gallery sync complete.',
    found: products.length,
    availableOnline,
    new: newCount,
    updated: updatedCount,
    unavailable: unavailableResult.rowCount ?? 0,
    last_synced_at: now,
  };
}
