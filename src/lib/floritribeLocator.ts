import { fetchWithRetry } from './fetchWithRetry';

export interface FloritribeFlorist {
  name: string;
  distanceKm: number;
  distanceText: string;
  businessType: string;
  address?: string;
  phone?: string;
  slug?: string;
  memberId?: number;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface FloritribeResponse {
  success: boolean;
  origin?: string;
  count?: number;
  florists?: unknown[];
}

export class FloritribeLocatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FloritribeLocatorError';
  }
}

export interface NearestFloristsInput {
  city: string;
  pincode: string;
  limit?: number;
  searchLatitude?: number;
  searchLongitude?: number;
}

function getEnv(name: string): string | undefined {
  return process.env[name];
}

function isValidPincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}

function toStringField(value: unknown, fallback?: string): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function toNumberField(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toIntegerField(value: unknown): number | undefined {
  const parsed = toNumberField(value);
  if (parsed !== undefined && Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}

function firstStringField(...values: unknown[]): string | undefined {
  for (const value of values) {
    const candidate = toStringField(value);
    if (candidate) return candidate;
  }
  return undefined;
}

function firstNumberField(...values: unknown[]): number | undefined {
  for (const value of values) {
    const candidate = toNumberField(value);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}

function firstIntegerField(...values: unknown[]): number | undefined {
  for (const value of values) {
    const candidate = toIntegerField(value);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}

function isRealPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return false;
  if (/[xX*_]/.test(value)) return false;
  return true;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(
  distanceKm: number,
  calculatedFromCoordinates = false
): string {
  if (distanceKm < 0.001) {
    return 'Same PIN code';
  }

  if (calculatedFromCoordinates) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  }

  // API-supplied distances without real coordinates: always show kilometres
  // rounded to one decimal place to avoid artificial "1 m" / "10 m" values.
  return `${distanceKm.toFixed(1)} km`;
}

function mapFlorist(value: unknown): FloritribeFlorist | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;

  const rawName = firstStringField(
    item.florist,
    item.name,
    item.floristName,
    item.businessName,
    item.shopName,
    item.title
  );

  if (!rawName) {
    return null;
  }

  const rawDistance =
    firstNumberField(item.distanceKm, item.distance) ??
    0;

  const phone = (() => {
    const candidate = firstStringField(
      item.phone,
      item.mobile,
      item.phoneNumber,
      item.phone_number,
      item.contact,
      item.contactNumber,
      item.contact_number,
      item.mobileNumber,
      item.mobile_number,
      item.landline,
      item.businessPhone
    );
    return candidate && isRealPhone(candidate) ? candidate : undefined;
  })();

  const address = firstStringField(
    item.address,
    item.fullAddress,
    item.shopAddress,
    item.street,
    item.location
  );

  return {
    name: rawName,
    distanceKm: rawDistance,
    distanceText: '',
    businessType:
      firstStringField(
        item.businessType,
        item.type,
        item.shopType,
        item.category
      ) ?? '',
    address,
    phone,
    slug: firstStringField(item.slug, item.handle, item.businessSlug),
    memberId: firstIntegerField(
      item.memberId,
      item.member_id,
      item.userId,
      item.user_id,
      item.businessId,
      item.business_id
    ),
    pincode: firstStringField(
      item.pincode,
      item.postalCode,
      item.zip,
      item.zipCode
    ),
    latitude: firstNumberField(
      item.latitude,
      item.lat
    ),
    longitude: firstNumberField(
      item.longitude,
      item.lng,
      item.lon,
      item.long
    ),
  };
}

export async function getNearestFlorists({
  city,
  pincode,
  limit = 3,
  searchLatitude,
  searchLongitude,
}: NearestFloristsInput): Promise<FloritribeFlorist[]> {
  const baseUrl = getEnv('FLORITRIBE_NEAREST_FLORIST_API_URL')?.trim();
  const apiKey = getEnv('FLORITRIBE_NEAREST_FLORIST_API_KEY')?.trim();

  if (!baseUrl) {
    throw new FloritribeLocatorError('Floritribe API URL is not configured');
  }

  if (!apiKey) {
    throw new FloritribeLocatorError('Floritribe API key is not configured');
  }

  const cleanCity = city.trim();
  const cleanPincode = pincode.trim();

  if (!cleanCity) {
    throw new FloritribeLocatorError('City is required');
  }

  if (!isValidPincode(cleanPincode)) {
    throw new FloritribeLocatorError('A valid 6-digit PIN code is required');
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new FloritribeLocatorError('Limit must be between 1 and 20');
  }

  if (
    (searchLatitude !== undefined && searchLongitude === undefined) ||
    (searchLatitude === undefined && searchLongitude !== undefined)
  ) {
    throw new FloritribeLocatorError(
      'Both searchLatitude and searchLongitude are required when using coordinates'
    );
  }

  const url = new URL(baseUrl);
  url.searchParams.set('city', cleanCity);
  url.searchParams.set('pincode', cleanPincode);
  url.searchParams.set('limit', String(limit));

  let response: Response;
  try {
    response = await fetchWithRetry(
      url.toString(),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Flora-API-Key': apiKey,
        },
      },
      { retries: 1, retryDelay: 500, retryOn: [408, 429, 500, 502, 503, 504] }
    );
  } catch (error) {
    throw new FloritribeLocatorError('Floritribe API request failed');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const detail =
      data && typeof data === 'object'
        ? firstStringField(
            (data as Record<string, unknown>).error,
            (data as Record<string, unknown>).message,
            (data as Record<string, unknown>).title,
            (data as Record<string, unknown>).detail
          )
        : undefined;
    throw new FloritribeLocatorError(
      `Floritribe API request failed: ${response.status}${detail ? ` - ${detail}` : ''}`
    );
  }

  if (!data || typeof data !== 'object') {
    throw new FloritribeLocatorError('Floritribe API returned an unexpected response');
  }

  const apiResponse = data as FloritribeResponse;
  const apiRecord = data as Record<string, unknown>;

  if (apiResponse.success !== true) {
    const apiError = firstStringField(apiRecord.error, apiRecord.message);
    throw new FloritribeLocatorError(
      apiError
        ? `Floritribe API error: ${apiError}`
        : 'Floritribe API returned no results'
    );
  }

  if (!Array.isArray(apiResponse.florists)) {
    throw new FloritribeLocatorError('Floritribe API returned an unexpected response');
  }

  const searchLat = searchLatitude;
  const searchLng = searchLongitude;
  const canCalculateRealDistance =
    searchLat !== undefined && searchLng !== undefined;

  const mapped = apiResponse.florists
    .map(mapFlorist)
    .filter((florist): florist is FloritribeFlorist => florist !== null)
    .map((florist, index) => ({ florist, originalIndex: index }));

  for (const { florist } of mapped) {
    if (
      searchLat !== undefined &&
      searchLng !== undefined &&
      florist.latitude !== undefined &&
      florist.longitude !== undefined
    ) {
      florist.distanceKm = haversineDistance(
        searchLat,
        searchLng,
        florist.latitude,
        florist.longitude
      );
      florist.distanceText = formatDistance(florist.distanceKm, true);
    } else if (florist.distanceKm < 0.001) {
      // The Floritribe API returns 0 km / "1 m" for the exact same PIN code;
      // without coordinates we cannot know the real distance, so we state that.
      florist.distanceText = formatDistance(florist.distanceKm, false);
    } else {
      florist.distanceText = formatDistance(florist.distanceKm, false);
    }
  }

  if (canCalculateRealDistance) {
    // If the caller supplied coordinates, re-sort by the computed real distance.
    mapped.sort((a, b) => a.florist.distanceKm - b.florist.distanceKm);
  }

  return mapped
    .map(({ florist }) => florist)
    .slice(0, limit);
}

export function formatFloristList(
  florists: FloritribeFlorist[],
  city: string,
  pincode: string,
  includeDetails = true
): string {
  if (florists.length === 0) {
    return "Sorry 😊 I couldn't find an IFA florist registered near that location. Would you like me to check another PIN code?";
  }

  const header = `IFA florists near ${pincode}, ${city}:\n\n`;
  const lines = florists.slice(0, 3).map((florist, index) => {
    const parts: string[] = [
      `${index + 1}. ${florist.name} — ${florist.distanceText}`,
    ];
    if (includeDetails && florist.address) {
      parts.push(`   ${florist.address}`);
    }
    return parts.join('\n');
  });

  return header + lines.join('\n') + '\n\nWould you like the contact details of the nearest one?';
}

export function findFloristByNameOrNearest(
  florists: FloritribeFlorist[],
  query?: string
): FloritribeFlorist | null {
  if (florists.length === 0) return null;

  if (query && query.trim()) {
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const match = florists.find((florist) => {
      const normalizedName = florist.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedName)
      );
    });
    if (match) return match;
  }

  return florists[0];
}

export function formatFloristContact(florist: FloritribeFlorist): string {
  const lines: string[] = [florist.name];

  if (florist.address) {
    lines.push(`📍 ${florist.address}`);
  } else {
    lines.push('📍 Address not available');
  }

  if (florist.phone) {
    lines.push(`📞 ${florist.phone}`);
  } else {
    lines.push('📞 Phone number not available');
  }

  return lines.join('\n');
}
