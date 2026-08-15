const BASE_URL = (process.env.FLORAPRISE_ERP_API_URL || 'https://api.floraprise.com').replace(/\/$/, '');

export class FlorapriseApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FlorapriseApiError';
    this.status = status;
  }
}

export interface FlorapriseAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAtUtc?: string;
  companyId?: string;
  raw?: unknown;
}

function assertCredentials() {
  if (!process.env.FLORAPRISE_ERP_EMAIL || !process.env.FLORAPRISE_ERP_PASSWORD) {
    throw new FlorapriseApiError(
      'FLORAPRISE_ERP_EMAIL and FLORAPRISE_ERP_PASSWORD are not configured'
    );
  }
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(20000),
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  return { ok: res.ok, status: res.status, body: parsed };
}

export async function login(): Promise<FlorapriseAuth> {
  assertCredentials();

  const email = process.env.FLORAPRISE_ERP_EMAIL!;
  const password = process.env.FLORAPRISE_ERP_PASSWORD!;

  const res = await request('POST', '/api/auth/login', { email, password });
  if (!res.ok) {
    throw new FlorapriseApiError(`ERP login failed: ${res.status}`, res.status);
  }

  const body = res.body;

  if (typeof body === 'string' && body.trim().length > 0) {
    return { accessToken: body.trim() };
  }

  if (!body || typeof body !== 'object') {
    throw new FlorapriseApiError('ERP login response was empty or unrecognised');
  }

  function extractCompanyId(obj: Record<string, unknown>): string | undefined {
    if (typeof obj.companyId === 'string') return obj.companyId;
    const tenant =
      obj.tenant && typeof obj.tenant === 'object' ? (obj.tenant as Record<string, unknown>) : undefined;
    if (tenant) {
      if (typeof tenant.id === 'string') return tenant.id;
      if (typeof tenant.companyId === 'string') return tenant.companyId;
      if (typeof tenant.tenantId === 'string') return tenant.tenantId;
    }
    if (typeof obj.tenant === 'string') return obj.tenant;
    const user =
      obj.user && typeof obj.user === 'object' ? (obj.user as Record<string, unknown>) : undefined;
    if (user) {
      if (typeof user.companyId === 'string') return user.companyId;
      const userTenant =
        user.tenant && typeof user.tenant === 'object' ? (user.tenant as Record<string, unknown>) : undefined;
      if (userTenant && typeof userTenant.id === 'string') return userTenant.id;
    }
    return undefined;
  }

  const obj = body as Record<string, unknown>;
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

  if (!accessToken) {
    throw new FlorapriseApiError('ERP login response did not contain an access token');
  }

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
    raw: body,
  };
}

export async function refresh(refreshToken: string): Promise<FlorapriseAuth> {
  const res = await request('POST', '/api/auth/refresh', { refreshToken });
  if (!res.ok) {
    throw new FlorapriseApiError(`ERP token refresh failed: ${res.status}`, res.status);
  }

  const body = res.body;
  if (typeof body === 'string' && body.trim().length > 0) {
    return { accessToken: body.trim() };
  }

  if (!body || typeof body !== 'object') {
    throw new FlorapriseApiError('ERP refresh response was empty or unrecognised');
  }

  function extractCompanyId(obj: Record<string, unknown>): string | undefined {
    if (typeof obj.companyId === 'string') return obj.companyId;
    const tenant =
      obj.tenant && typeof obj.tenant === 'object' ? (obj.tenant as Record<string, unknown>) : undefined;
    if (tenant) {
      if (typeof tenant.id === 'string') return tenant.id;
      if (typeof tenant.companyId === 'string') return tenant.companyId;
      if (typeof tenant.tenantId === 'string') return tenant.tenantId;
    }
    if (typeof obj.tenant === 'string') return obj.tenant;
    const user =
      obj.user && typeof obj.user === 'object' ? (obj.user as Record<string, unknown>) : undefined;
    if (user) {
      if (typeof user.companyId === 'string') return user.companyId;
      const userTenant =
        user.tenant && typeof user.tenant === 'object' ? (user.tenant as Record<string, unknown>) : undefined;
      if (userTenant && typeof userTenant.id === 'string') return userTenant.id;
    }
    return undefined;
  }

  const obj = body as Record<string, unknown>;
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

  if (!accessToken) {
    throw new FlorapriseApiError('ERP refresh response did not contain an access token');
  }

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
    raw: body,
  };
}

export async function get(path: string, accessToken: string): Promise<unknown> {
  const res = await request('GET', path, undefined, accessToken);
  if (!res.ok) {
    throw new FlorapriseApiError(`ERP GET ${path} failed: ${res.status}`, res.status);
  }
  return res.body;
}

export async function post(path: string, body: unknown, accessToken: string): Promise<unknown> {
  const res = await request('POST', path, body, accessToken);
  if (!res.ok) {
    throw new FlorapriseApiError(`ERP POST ${path} failed: ${res.status}`, res.status);
  }
  return res.body;
}

export async function getCompanyId(accessToken: string): Promise<string | undefined> {
  if (process.env.FLORAPRISE_ERP_COMPANY_ID) {
    return process.env.FLORAPRISE_ERP_COMPANY_ID;
  }

  try {
    const me = await get('/api/auth/me', accessToken);
    if (me && typeof me === 'object') {
      const m = me as Record<string, unknown>;
      if (typeof m.companyId === 'string') return m.companyId;
      const company = m.company as Record<string, unknown> | undefined;
      if (company) {
        if (typeof company.id === 'string') return company.id;
        if (typeof company.companyId === 'string') return company.companyId;
      }
    }
  } catch {
    // fall through
  }

  return undefined;
}
