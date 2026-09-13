/**
 * IFA web knowledge source utilities.
 *
 * Provides caching and fetching infrastructure for IFA website data.
 * Implements HTML parsing for static IFA website pages.
 */

import { fetchWithRetry } from '@/lib/fetchWithRetry';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const EVENTS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes for events (more time-sensitive)

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  isStale: boolean;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = CACHE_TTL_MS
): Promise<{ data: T; isStale: boolean }> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && now - entry.cachedAt < ttlMs) {
    return { data: entry.data, isStale: false };
  }

  try {
    const data = await fetcher();
    cache.set(key, { data, cachedAt: now, isStale: false });
    return { data, isStale: false };
  } catch (error) {
    // If fetch fails, return cached data if available (even if stale)
    if (entry) {
      console.warn(`IFA website fetch failed for ${key}, using cached data from ${new Date(entry.cachedAt).toISOString()}`);
      return { data: entry.data, isStale: true };
    }
    // No cached data available, rethrow with user-friendly message
    throw new Error('Unable to fetch IFA information at this time. Please try again later.');
  }
}

export function clearCache(): void {
  cache.clear();
}

/**
 * Fetch IFA website page HTML.
 */
export async function fetchIfaWebsitePage(
  path: string
): Promise<string> {
  const baseUrl = process.env.IFA_WEBSITE_URL?.trim() || 'https://ifaflorist.com';
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetchWithRetry(
      url,
      { method: 'GET', headers: { Accept: 'text/html' } },
      { retries: 1, retryDelay: 500, retryOn: [408, 429, 500, 502, 503, 504] }
    );

    if (!response.ok) {
      throw new Error(`IFA website fetch failed: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch IFA website page ${path}:`, error);
    throw error;
  }
}

/**
 * Extract text content from HTML, stripping tags.
 */
function extractText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract email from Cloudflare protected email span.
 */
function extractProtectedEmail(html: string): string {
  const match = html.match(/__cf_email__"[^>]*>([^<]+)</);
  if (match) {
    // Cloudflare email is encoded; for now return the protected placeholder
    return '[email protected]';
  }
  return '';
}

/**
 * Extract general IFA information from homepage and about page.
 */
export async function fetchIfaGeneralInfo(): Promise<{
  founded: string;
  mission: string;
  vision: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  website: string;
  memberCount: string;
  stateCount: string;
  meetCount: string;
  sourceUrl: string;
  retrievedAt: string;
  isStale: boolean;
}> {
  const cacheKey = 'ifa-general-info';
  const result = await fetchWithCache(cacheKey, async () => {
    let homepageHtml = '';
    let aboutHtml = '';

    try {
      homepageHtml = await fetchIfaWebsitePage('/');
    } catch (error) {
      console.error('Failed to fetch IFA homepage:', error);
      // Continue with empty HTML, will use fallbacks
    }

    try {
      aboutHtml = await fetchIfaWebsitePage('/about');
    } catch (error) {
      console.error('Failed to fetch IFA about page:', error);
      // Continue with empty HTML, will use fallbacks
    }

    // Extract from homepage
    const memberCountMatch = homepageHtml.match(/(\d+)\+?\s*Members/i);
    const stateCountMatch = homepageHtml.match(/(\d+)\+?\s*States/i);
    const meetCountMatch = homepageHtml.match(/(\d+)\s*IFA Meets/i);
    const sinceMatch = homepageHtml.match(/(\d{4})\s*Since/i);
    const phoneMatch = homepageHtml.match(/Phone:\s*([+\d\s]+)/);
    const addressMatch = homepageHtml.match(/Address:\s*([^\n]+)/);

    // Extract from about page
    const missionMatch = aboutHtml.match(/Our Mission\s*<\/h2>\s*<p>([^<]+)</);
    const visionMatch = aboutHtml.match(/Our Vision\s*<\/h2>\s*<p>([^<]+)</);
    const whoWeAreMatch = aboutHtml.match(/Who We Are\s*<\/h2>\s*<p>([^<]+)</);

    return {
      founded: sinceMatch ? sinceMatch[1] : '2015',
      mission: missionMatch ? missionMatch[1].trim() : 'To connect, support and empower florists across India.',
      vision: visionMatch ? visionMatch[1].trim() : 'To build a strong, united and globally respected Indian floral industry.',
      description: whoWeAreMatch ? whoWeAreMatch[1].trim() : 'India Florist Association (IFA) is India\'s leading floral industry organization.',
      contactEmail: extractProtectedEmail(homepageHtml) || '[email protected]',
      contactPhone: phoneMatch ? phoneMatch[1].trim() : '+91 9990044406',
      address: addressMatch ? addressMatch[1].trim() : 'West Patel Nagar, New Delhi, India',
      website: 'https://ifaflorist.com',
      memberCount: memberCountMatch ? memberCountMatch[1] + '+' : '5000+',
      stateCount: stateCountMatch ? stateCountMatch[1] + '+' : '25+',
      meetCount: meetCountMatch ? meetCountMatch[1] : '8',
      sourceUrl: 'https://ifaflorist.com/about',
      retrievedAt: new Date().toISOString(),
      isStale: false,
    };
  });
  return { ...result.data, isStale: result.isStale };
}

/**
 * Extract membership information from homepage and join page.
 */
export async function fetchIfaMembershipInfo(): Promise<{
  annualFee: string;
  joinUrl: string;
  eligibleCategories: string[];
  benefits: string[];
  sourceUrl: string;
  retrievedAt: string;
  isStale: boolean;
}> {
  const cacheKey = 'ifa-membership-info';
  const result = await fetchWithCache(cacheKey, async () => {
    let homepageHtml = '';
    let joinHtml = '';
    let aboutHtml = '';

    try {
      homepageHtml = await fetchIfaWebsitePage('/');
    } catch (error) {
      console.error('Failed to fetch IFA homepage for membership info:', error);
    }

    try {
      joinHtml = await fetchIfaWebsitePage('/join');
    } catch (error) {
      console.error('Failed to fetch IFA join page:', error);
    }

    try {
      aboutHtml = await fetchIfaWebsitePage('/about');
    } catch (error) {
      console.error('Failed to fetch IFA about page for membership info:', error);
    }

    // Extract annual fee from homepage
    const feeMatch = homepageHtml.match(/Annual Membership\s*₹([\d,]+)/);

    // Extract benefits from homepage
    const benefitsSection = homepageHtml.match(/Why Join IFA([\s\S]*?)(?:IFA Meet|Become Part)/i);
    const benefits: string[] = [];
    if (benefitsSection) {
      const benefitMatches = benefitsSection[1].match(/###\s*([^<]+)/g);
      if (benefitMatches) {
        benefits.push(...benefitMatches.map((b) => b.replace('###', '').trim()));
      }
    }

    // Extract eligible categories from about page
    const categoriesSection = aboutHtml.match(/Who Can Join IFA([\s\S]*?)(?:Ready to Grow)/i);
    const categories: string[] = [];
    if (categoriesSection) {
      const categoryMatches = categoriesSection[1].match(/<li>([^<]+)</g);
      if (categoryMatches) {
        categories.push(...categoryMatches.map((c) => c.replace(/<li>|<\/li>/g, '').trim()));
      }
    }

    return {
      annualFee: feeMatch ? `₹${feeMatch[1]}` : '₹2,400',
      joinUrl: 'https://ifaflorist.com/join',
      eligibleCategories: categories.length > 0 ? categories : [
        'Retail florists',
        'Wholesalers',
        'Flower growers',
        'Floral designers',
        'Event florists',
        'Wedding decorators',
        'Suppliers',
        'Entrepreneurs',
      ],
      benefits: benefits.length > 0 ? benefits : [
        'Promotion & Visibility',
        'Networking',
        'Recognition',
        'Business Growth',
        'Industry Support',
        'Events & Exposure',
      ],
      sourceUrl: 'https://ifaflorist.com/join',
      retrievedAt: new Date().toISOString(),
      isStale: false,
    };
  });
  return { ...result.data, isStale: result.isStale };
}

/**
 * Extract leadership information from leadership page.
 */
export async function fetchIfaLeadership(): Promise<{
  president: string;
  vicePresident: string;
  secretary: string;
  treasurer: string;
  officeBearers: Array<{ name: string; role: string }>;
  stateHeads: Array<{ state: string; name: string }>;
  sourceUrl: string;
  retrievedAt: string;
  isStale: boolean;
}> {
  const cacheKey = 'ifa-leadership';
  const result = await fetchWithCache(cacheKey, async () => {
    let html = '';

    try {
      html = await fetchIfaWebsitePage('/leadership');
    } catch (error) {
      console.error('Failed to fetch IFA leadership page:', error);
      // Continue with empty HTML, will return empty leadership
    }

    // Extract core leadership - dynamic parsing without hardcoded names
    const presidentMatch = html.match(/###\s*([^<]+)\s*<\/h3>\s*<p>President/i);
    const vpMatch = html.match(/###\s*([^<]+)\s*<\/h3>\s*<p>Vice President/i);
    const secretaryMatch = html.match(/###\s*([^<]+)\s*<\/h3>\s*<p>Secretary/i);
    const treasurerMatch = html.match(/###\s*([^<]+)\s*<\/h3>\s*<p>Treasurer/i);

    // Extract office bearers
    const officeBearers: Array<{ name: string; role: string }> = [];
    const bearerMatches = html.match(/###\s*([^<]+)\s*<\/h3>\s*<p>([^<]+)/g);
    if (bearerMatches) {
      bearerMatches.forEach((match) => {
        const nameMatch = match.match(/###\s*([^<]+)/);
        const roleMatch = match.match(/<p>([^<]+)/);
        if (nameMatch && roleMatch) {
          officeBearers.push({
            name: nameMatch[1].trim(),
            role: roleMatch[1].trim(),
          });
        }
      });
    }

    // Extract state heads
    const stateHeads: Array<{ state: string; name: string }> = [];
    const stateSection = html.match(/State Heads([\s\S]*?)(?:State Coordinators)/i);
    if (stateSection) {
      const stateMatches = stateSection[1].match(/###\s*([^<]+)\s*<\/h3>\s*<p>([^<]+)/g);
      if (stateMatches) {
        stateMatches.forEach((match) => {
          const stateMatch = match.match(/###\s*([^<]+)/);
          const nameMatch = match.match(/<p>([^<]+)/);
          if (stateMatch && nameMatch) {
            stateHeads.push({
              state: stateMatch[1].trim(),
              name: nameMatch[1].trim(),
            });
          }
        });
      }
    }

    return {
      president: presidentMatch ? presidentMatch[1].trim() : '',
      vicePresident: vpMatch ? vpMatch[1].trim() : '',
      secretary: secretaryMatch ? secretaryMatch[1].trim() : '',
      treasurer: treasurerMatch ? treasurerMatch[1].trim() : '',
      officeBearers,
      stateHeads,
      sourceUrl: 'https://ifaflorist.com/leadership',
      retrievedAt: new Date().toISOString(),
      isStale: false,
    };
  });
  return { ...result.data, isStale: result.isStale };
}

/**
 * Extract events information from IFA Meet and Exhibition pages.
 */
export async function fetchIfaEvents(): Promise<{
  upcomingEvent: {
    name: string;
    date: string;
    venue: string;
    registrationUrl: string;
    registrationFee: string;
    packages: Array<{ name: string; price: string; inclusions: string[] }>;
  } | null;
  exhibition: {
    date: string;
    venue: string;
    packages: Array<{ type: string; size: string; price: string; inclusions: string[] }>;
    accommodation: string;
  } | null;
  sourceUrl: string;
  retrievedAt: string;
  isStale: boolean;
}> {
  const cacheKey = 'ifa-events';
  const result = await fetchWithCache(cacheKey, async () => {
    let meetHtml = '';
    let exhibitionHtml = '';

    try {
      meetHtml = await fetchIfaWebsitePage('/ifa-meet');
    } catch (error) {
      console.error('Failed to fetch IFA Meet page:', error);
    }

    try {
      exhibitionHtml = await fetchIfaWebsitePage('/exhibition');
    } catch (error) {
      console.error('Failed to fetch IFA Exhibition page:', error);
    }

    // Extract IFA Meet info
    const meetNameMatch = meetHtml.match(/# IFA Meet (\d+)/);
    const dateMatch = meetHtml.match(/(\d{1,2}(?:st|nd|rd|th)?\s*-\s*\d{1,2}(?:st|nd|rd|th)?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4})/i);
    const venueMatch = meetHtml.match(/New Delhi/i) ? 'New Delhi' : '';
    const feeMatch = meetHtml.match(/Starting\s*₹([\d,]+)/);

    // Extract packages
    const packages: Array<{ name: string; price: string; inclusions: string[] }> = [];
    const packageSection = meetHtml.match(/Registration Packages([\s\S]*?)(?:Event Highlights)/i);
    if (packageSection) {
      const packageMatches = packageSection[1].match(/###\s*([^<]+)([\s\S]*?)\[Register Now/g);
      if (packageMatches) {
        packageMatches.forEach((match) => {
          const nameMatch = match.match(/###\s*([^<]+)/);
          const priceMatch = match.match(/₹([\d,]+)/);
          const inclusions: string[] = [];
          const inclusionMatches = match.match(/- ✓ ([^<]+)/g);
          if (inclusionMatches) {
            inclusions.push(...inclusionMatches.map((i) => i.replace(/- ✓ /, '').trim()));
          }
          if (nameMatch) {
            packages.push({
              name: nameMatch[1].trim(),
              price: priceMatch ? `₹${priceMatch[1]}` : 'Contact for pricing',
              inclusions,
            });
          }
        });
      }
    }

    // Extract exhibition info
    const exhibitionDateMatch = exhibitionHtml.match(/(\d{1,2}–\d{1,2}\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4})/i);
    const exhibitionVenueMatch = exhibitionHtml.match(/The Tivoli, Chhatarpur, New Delhi/i) ? 'The Tivoli, Chhatarpur, New Delhi' : '';

    const exhibitionPackages: Array<{ type: string; size: string; price: string; inclusions: string[] }> = [];
    const exhibitionPackageSection = exhibitionHtml.match(/Exhibition Packages([\s\S]*?)(?:Customized Stall)/i);
    if (exhibitionPackageSection) {
      const typeMatches = exhibitionPackageSection[1].match(/###\s*Type ([A-D])([\s\S]*?)₹([\d,]+)/g);
      if (typeMatches) {
        typeMatches.forEach((match) => {
          const typeMatch = match.match(/Type ([A-D])/);
          const sizeMatch = match.match(/(\d+ Sq\. Mtr\.)/);
          const priceMatch = match.match(/₹([\d,]+)/);
          const inclusions: string[] = [];
          const inclusionMatches = match.match(/- ✓ ([^<]+)/g);
          if (inclusionMatches) {
            inclusions.push(...inclusionMatches.map((i) => i.replace(/- ✓ /, '').trim()));
          }
          if (typeMatch) {
            exhibitionPackages.push({
              type: typeMatch[1],
              size: sizeMatch ? sizeMatch[1] : '',
              price: priceMatch ? `₹${priceMatch[1]} + GST` : 'Contact for pricing',
              inclusions,
            });
          }
        });
      }
    }

    const accommodationMatch = exhibitionHtml.match(/Venue Accommodation\s*₹([\d,]+)/);

    return {
      upcomingEvent: {
        name: meetNameMatch ? `IFA Meet ${meetNameMatch[1]}` : 'IFA Meet 8',
        date: dateMatch ? dateMatch[1] : '18th - 19th August 2026',
        venue: venueMatch || 'New Delhi',
        registrationUrl: 'https://ifaflorist.com/ifa-meet/register',
        registrationFee: feeMatch ? `₹${feeMatch[1]}` : '₹7,000',
        packages,
      },
      exhibition: {
        date: exhibitionDateMatch ? exhibitionDateMatch[1] : '18–19 August 2026',
        venue: exhibitionVenueMatch || 'The Tivoli, Chhatarpur, New Delhi',
        packages: exhibitionPackages,
        accommodation: accommodationMatch ? `₹${accommodationMatch[1]} + Taxes` : '₹4,500 + Taxes',
      },
      sourceUrl: 'https://ifaflorist.com/ifa-meet',
      retrievedAt: new Date().toISOString(),
      isStale: false,
    };
  }, EVENTS_CACHE_TTL_MS);
  return { ...result.data, isStale: result.isStale };
}
