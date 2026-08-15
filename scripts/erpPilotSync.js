const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.resolve('.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
}

const BASE_URL = (env.FLORAPRISE_ERP_API_URL || 'https://api.floraprise.com').replace(/\/$/, '');
const EMAIL = env.FLORAPRISE_ERP_EMAIL;
const PASSWORD = env.FLORAPRISE_ERP_PASSWORD;
const DATABASE_URL = env.DATABASE_URL;

if (!EMAIL || !PASSWORD) {
  console.error('FLORAPRISE_ERP_EMAIL and FLORAPRISE_ERP_PASSWORD must be set in .env.local');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function ensureSchema() {
  await pool.query('ALTER TABLE IF EXISTS members ADD COLUMN IF NOT EXISTS external_company_id UUID UNIQUE');
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_design_gallery_member_external_unique ON design_gallery(member_id, external_id)'
  );
}

async function request(method, path, body, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

function extractCompanyId(obj) {
  if (typeof obj.companyId === 'string') return obj.companyId;
  if (obj.tenant && typeof obj.tenant === 'object') {
    if (typeof obj.tenant.id === 'string') return obj.tenant.id;
    if (typeof obj.tenant.companyId === 'string') return obj.tenant.companyId;
    if (typeof obj.tenant.tenantId === 'string') return obj.tenant.tenantId;
  }
  if (typeof obj.tenant === 'string') return obj.tenant;
  if (obj.user && typeof obj.user === 'object') {
    if (typeof obj.user.companyId === 'string') return obj.user.companyId;
    if (obj.user.tenant && typeof obj.user.tenant === 'object' && typeof obj.user.tenant.id === 'string') {
      return obj.user.tenant.id;
    }
  }
  return undefined;
}

async function login() {
  const res = await request('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (!res.ok) throw new Error(`ERP login failed: ${res.status} ${JSON.stringify(res.body)}`);

  if (typeof res.body === 'string' && res.body.trim().length > 0) {
    console.log('ERP login returned a string token (length', res.body.trim().length, ')');
    return { accessToken: res.body.trim() };
  }

  if (!res.body || typeof res.body !== 'object') {
    throw new Error('ERP login response was empty');
  }

  const obj = res.body;
  console.log('ERP login response keys:', Object.keys(obj).join(', '));

  const accessToken =
    typeof obj.accessToken === 'string'
      ? obj.accessToken
      : typeof obj.access_token === 'string'
        ? obj.access_token
        : typeof obj.token === 'string'
          ? obj.token
          : typeof obj.jwt === 'string'
            ? obj.jwt
            : undefined;

  if (!accessToken) throw new Error('ERP login response did not contain an access token');

  return {
    accessToken,
    refreshToken:
      typeof obj.refreshToken === 'string'
        ? obj.refreshToken
        : typeof obj.refresh_token === 'string'
          ? obj.refresh_token
          : undefined,
    expiresAtUtc:
      typeof obj.expiresAtUtc === 'string'
        ? obj.expiresAtUtc
        : typeof obj.expires_at === 'string'
          ? obj.expires_at
          : typeof obj.expires === 'string'
            ? obj.expires
            : undefined,
    companyId: extractCompanyId(obj),
    raw: obj,
  };
}

async function getCompanyId(accessToken) {
  if (env.FLORAPRISE_ERP_COMPANY_ID) return env.FLORAPRISE_ERP_COMPANY_ID;

  try {
    const me = await request('GET', '/api/auth/me', undefined, accessToken);
    if (me.ok && me.body && typeof me.body === 'object') {
      const m = me.body;
      if (typeof m.companyId === 'string') return m.companyId;
      if (m.company && typeof m.company === 'object') {
        if (typeof m.company.id === 'string') return m.company.id;
        if (typeof m.company.companyId === 'string') return m.company.companyId;
      }
    }
  } catch (e) {
    console.warn('Could not fetch /api/auth/me:', e.message);
  }

  return undefined;
}

function extractItems(response) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    return (
      (Array.isArray(response.data) ? response.data : undefined) ??
      (Array.isArray(response.items) ? response.items : undefined) ??
      (Array.isArray(response.results) ? response.results : undefined) ??
      (Array.isArray(response.products) ? response.products : undefined) ??
      (Array.isArray(response.records) ? response.records : undefined) ??
      []
    );
  }
  return [];
}

async function fetchPage(path, accessToken, page, pageSize) {
  const res = await request('GET', path, undefined, accessToken);
  if (!res.ok) throw new Error(`Fetch ${path} failed: ${res.status} ${JSON.stringify(res.body)}`);
  const items = extractItems(res.body);
  const totalCount =
    typeof res.body?.totalCount === 'number'
      ? res.body.totalCount
      : typeof res.body?.total === 'number'
        ? res.body.total
        : undefined;
  return { items, totalCount, hasMore: items.length === pageSize };
}

async function fetchFromPath(path, accessToken) {
  const pageSize = 100;
  const records = [];
  for (let page = 1; page <= 100; page++) {
    const pagedPath = path.includes('?') ? `${path}&Page=${page}&PageSize=${pageSize}` : `${path}?Page=${page}&PageSize=${pageSize}`;
    const { items, totalCount } = await fetchPage(pagedPath, accessToken, page, pageSize);
    if (!items.length) break;
    records.push(...items);
    if (totalCount !== undefined && records.length >= totalCount) break;
    if (items.length < pageSize) break;
  }
  return records;
}

async function fetchDesigns(accessToken) {
  const endpoints = [
    '/api/production/finished-goods/sellable',
    '/api/products/search',
    '/api/products/search?IsActive=true',
    '/api/production/recipes',
    '/api/ai/bouquet-recipes',
  ];

  for (const path of endpoints) {
    try {
      const res = await request('GET', path, undefined, accessToken);
      if (!res.ok) {
        console.warn(`Probe ${path} returned ${res.status}`);
        continue;
      }
      const items = extractItems(res.body);
      console.log(`Probe ${path}: ${items.length} items (top-level keys: ${Array.isArray(res.body) ? 'array' : Object.keys(res.body).join(', ')})`);
      if (items.length > 0) {
        console.log(`  First item keys: ${Object.keys(items[0]).join(', ')}`);
        const all = await fetchFromPath(path, accessToken);
        console.log(`Using ${path} with ${all.length} total records`);
        return { source: path, records: all };
      }
    } catch (e) {
      console.warn(`Probe ${path} error: ${e.message}`);
    }
  }

  return { source: null, records: [] };
}

function toDecimal(value) {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  return null;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'True' || value === '1' || value === 1) return true;
  return false;
}

function mapProduct(p) {
  const externalId = String(p.id ?? p.productId ?? '');
  if (!externalId || externalId === 'undefined' || externalId === 'null') return null;

  const name = String(p.name ?? p.productName ?? '').trim() || null;
  if (!name) return null;

  const settings = p.settings && typeof p.settings === 'object' ? p.settings : {};
  const flowerAttributes =
    p.flowerAttributes && typeof p.flowerAttributes === 'object' ? p.flowerAttributes : {};

  const tags = Array.isArray(p.tags) ? p.tags.map(String) : [];
  const seasonality = Array.isArray(flowerAttributes.seasonality)
    ? flowerAttributes.seasonality.map(String)
    : [];

  const flowerList = [];
  if (flowerAttributes.variety) flowerList.push(String(flowerAttributes.variety));
  if (flowerAttributes.color) flowerList.push(String(flowerAttributes.color));
  if (tags.length) flowerList.push(...tags);
  if (seasonality.length) flowerList.push(...seasonality);
  if (p.productType) flowerList.push(String(p.productType));

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
      typeof p.description === 'string'
        ? p.description
        : typeof p.shortDescription === 'string'
          ? p.shortDescription
          : null,
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
  };
}

async function testImagePublic(imageUrl) {
  if (!imageUrl) return 'no_image';
  try {
    const res = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    return res.ok ? 'public' : `auth_or_error_${res.status}`;
  } catch (e) {
    return `error_${e.message}`;
  }
}

async function main() {
  await ensureSchema();

  const memberId = 1;
  const memberRes = await pool.query('SELECT external_company_id, name, email FROM members WHERE id = $1', [memberId]);
  const member = memberRes.rows[0];

  if (!member) {
    throw new Error(`Member ${memberId} does not exist. Run the seed-admin endpoint first.`);
  }

  const auth = await login();
  console.log('ERP login succeeded.');
  console.log('Token expiry:', auth.expiresAtUtc || 'unknown');

  const companyId = auth.companyId ?? (await getCompanyId(auth.accessToken));
  if (!companyId) {
    throw new Error('Could not determine ERP companyId. Set FLORAPRISE_ERP_COMPANY_ID if needed.');
  }
  console.log('ERP companyId:', companyId);

  if (member.external_company_id) {
    if (member.external_company_id.toLowerCase() !== companyId.toLowerCase()) {
      throw new Error(
        `Company mismatch. Expected ${member.external_company_id}, logged in as ${companyId}.`
      );
    }
    console.log(`Confirmed mapping: member_id=${memberId} -> companyId=${companyId}`);
  } else {
    await pool.query('UPDATE members SET external_company_id = $1 WHERE id = $2', [companyId, memberId]);
    console.log(`Stored mapping: member_id=${memberId} -> companyId=${companyId}`);
  }

  const { source, records } = await fetchDesigns(auth.accessToken);
  console.log('Source endpoint:', source || 'none');
  console.log('Records returned:', records.length);

  if (!records.length) {
    console.log('No records returned by the ERP for any known endpoint.');
    await pool.query(
      `INSERT INTO catalog_sources (member_id, source, status, last_synced_at)
       VALUES ($1, 'design_gallery', 'connected', NOW())
       ON CONFLICT (member_id) DO UPDATE SET
         source = 'design_gallery',
         status = 'connected',
         last_synced_at = NOW(),
         updated_at = NOW()`,
      [memberId]
    );
    await pool.end();
    process.exit(0);
  }

  // Report the raw keys of the first record for verification
  console.log('First record sample keys:', Object.keys(records[0]).join(', '));
  const sample = records[0];
  for (const k of Object.keys(sample).slice(0, 8)) {
    const v = sample[k];
    console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120));
  }

  const mapped = records.map(mapProduct).filter(Boolean);
  console.log('Mappable products:', mapped.length);

  const existingRes = await pool.query('SELECT external_id FROM design_gallery WHERE member_id = $1', [memberId]);
  const existingIds = new Set(existingRes.rows.map((r) => String(r.external_id)));

  const newCount = mapped.filter((m) => !existingIds.has(m.external_id)).length;
  const updatedCount = mapped.length - newCount;
  const availableOnline = mapped.filter((m) => m.availability).length;

  const now = new Date().toISOString();

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
        now,
      ]
    );
  }

  const ids = mapped.map((m) => m.external_id);
  const unavailableResult = ids.length
    ? await pool.query(
        `UPDATE design_gallery
         SET availability = false, updated_at = NOW()
         WHERE member_id = $1 AND external_id <> ALL($2::text[])`,
        [memberId, ids]
      )
    : { rowCount: 0 };

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

  // Image check for the first available product that has an image
  const imageSample = mapped.find((m) => m.image_url) || null;
  let imageStatus = 'no_image_in_products';
  if (imageSample) {
    imageStatus = await testImagePublic(imageSample.image_url);
    console.log('Sample image URL:', imageSample.image_url);
    console.log('Sample image accessibility:', imageStatus);
  }

  console.log('\n--- Sync summary ---');
  console.log('Records found:', records.length);
  console.log('Mappable:', mapped.length);
  console.log('Available online:', availableOnline);
  console.log('New:', newCount);
  console.log('Updated:', updatedCount);
  console.log('Marked unavailable:', unavailableResult.rowCount ?? 0);
  console.log('Image status:', imageStatus);

  await pool.end();
}

main().catch(async (e) => {
  console.error('Pilot sync failed:', e.message);
  if (pool) await pool.end();
  process.exit(1);
});
