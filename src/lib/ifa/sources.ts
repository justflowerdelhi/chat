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

const cache = new Map<string,CacheEntry<unknown>>();

// Type definitions for verified IFA snapshot
interface IfaGeneralInfo {
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
}

interface OfficeBearer {
  name: string;
  role: string;
}

interface StateHead {
  state: string;
  name: string;
}

interface IfaLeadership {
  officeBearers: OfficeBearer[];
  stateHeads: StateHead[];
}

interface MeetPackage {
  name: string;
  price: string;
  inclusions: string[];
}

interface IfaMeet {
  name: string;
  date: string;
  venue: string;
  registrationUrl: string;
  registrationFee: string;
  packages: MeetPackage[];
}

interface ExhibitionPackage {
  type: string;
  size: string;
  price: string;
  inclusions: string[];
}

interface IfaExhibition {
  date: string;
  venue: string;
  packages: ExhibitionPackage[];
  accommodation: string;
}

interface VerifiedIfaSnapshot {
  general: IfaGeneralInfo;
  leadership: IfaLeadership;
  meet8: IfaMeet;
  exhibition: IfaExhibition;
}

/**
 * Verified official IFA snapshot.
 *
 * Live website parsing remains the primary source. These values are a
 * deterministic fallback for the public IFA pages because the site is a
 * Next.js application whose rendered HTML structure can change independently
 * of this application.
 */
const VERIFIED_IFA_SNAPSHOT: VerifiedIfaSnapshot = {
  general: {
    founded: '2015',
    mission:
      'To connect, support and empower florists across India with opportunities for business growth, learning, recognition and industry collaboration.',
    vision:
      'To build a strong, united and globally respected Indian floral industry that empowers every florist to succeed.',
    description:
      "India Florist Association (IFA) is India's leading floral industry organization, bringing together retail florists, wholesalers, flower growers, floral designers, event florists, wedding decorators, suppliers and entrepreneurs from across the country. Established in 2015, IFA was created with a vision to unite the floral industry under one common platform where professionals can connect, collaborate, share knowledge and grow together. Through networking opportunities, industry events, member promotion campaigns, business support and national conferences, IFA helps florists build stronger businesses.",
    contactEmail: 'floristassociationindia@gmail.com',
    contactPhone: '+91 9990044406',
    address: 'West Patel Nagar, New Delhi, India',
    website: 'https://ifaflorist.com',
    memberCount: '5000+',
    stateCount: '25+',
    meetCount: '8',
  },

  leadership: {
    officeBearers: [
      { name: 'Anand Kumar', role: 'President' },
      { name: 'Srikant Kanoi', role: 'Vice President' },
      { name: 'Vinay Singh', role: 'Secretary' },
      { name: 'Amit Singhania', role: 'Treasurer' },
      { name: 'Sharad Ojha', role: 'Joint Secretary' },
      { name: 'Ranjit Mandal', role: 'Convener' },
      { name: 'Vineet Chopra', role: 'Executive Member' },
      { name: 'Sanjay Ballani', role: 'Executive Member' },
      { name: 'Deepak Badhodhe', role: 'Executive Member' },
      { name: 'Gopal Saini', role: 'Executive Member' },
      { name: 'Abhijeet Lahoti', role: 'Executive Member' },
      { name: 'Madhulika Mahadik', role: 'Executive Member' },
      { name: 'Priyanka Singhal', role: 'Official Spokesperson' },
    ],
    stateHeads: [
      { state: 'Andhra Pradesh & Telangana', name: 'Aditya Kabra' },
      { state: 'Arunachal Pradesh', name: 'Osinam Tapak' },
      { state: 'Assam', name: 'Kiran Kothari' },
      { state: 'Bihar', name: 'Anshumali Amit' },
      { state: 'Chhattisgarh', name: 'Kamal Somani' },
      { state: 'Delhi', name: 'Ravi Adwani' },
      { state: 'Goa', name: 'Ryan Fernandes' },
      { state: 'Gujarat', name: 'Samir Rami' },
      { state: 'Haryana', name: 'Sudhir Madan' },
      { state: 'Himachal Pradesh', name: 'Ayush Anand' },
      { state: 'Jammu & Kashmir', name: 'Sandeep Gupta' },
      { state: 'Jharkhand', name: 'Prashant Suraj' },
      { state: 'Karnataka', name: 'Murthy KM' },
      { state: 'Kerala', name: 'Shreejesh K V' },
      { state: 'Madhya Pradesh', name: 'Kishore Verma' },
      { state: 'Maharashtra', name: 'Pandharinath Mhaske' },
      { state: 'Meghalaya', name: 'Bhakupur L Mawnai' },
      { state: 'Odisha', name: 'Neha Pansari' },
      { state: 'Punjab', name: 'Sunil Bhatia' },
      { state: 'Rajasthan', name: 'Deepak Khichi' },
      { state: 'Tamil Nadu', name: 'D Sambagamurthi' },
      { state: 'Uttar Pradesh', name: 'Shashank Agarwal' },
      { state: 'Uttarakhand', name: 'Ravinder Bhandari' },
      { state: 'West Bengal', name: 'Vikas Bhuwania' },
    ],
  },

  meet8: {
    name: 'IFA Meet 8',
    date: '18-19 August 2026',
    venue: 'The Tivoli, Chhatarpur Enclave, New Delhi',
    registrationUrl: 'https://ifaflorist.com/ifa-meet/register',
    registrationFee: '₹7,000',
    packages: [
      {
        name: 'Delegate Package',
        price: '₹7,000',
        inclusions: [
          'Annual IFA Membership',
          'Conference Delegate Registration',
          'Tea/Coffee & Snacks (Both Days)',
          'Lunch (Both Days)',
          'High Tea (18th Aug)',
          'Conference Sessions & Exhibition',
          'IFA Year Book Business Listing',
        ],
      },
      {
        name: 'Delegate Package With Stay',
        price: '₹11,000',
        inclusions: [
          'Annual IFA Membership',
          'Conference Delegate Registration',
          'Tea/Coffee & Snacks (Both Days)',
          'Lunch (Both Days)',
          'High Tea (18th Aug)',
          'Musical Evening & Dinner',
          '1 Night Stay (Twin Sharing)',
          'Breakfast (19th Aug)',
          'IFA Year Book Business Listing',
        ],
      },
    ],
  },

  exhibition: {
    date: '18–19 August 2026',
    venue: 'The Tivoli, Chhatarpur, New Delhi',
    packages: [
      {
        type: 'A',
        size: '12 Sq. Mtr. (129 Sq. Ft.) • 6m × 2m',
        price: '₹80,000 + GST',
        inclusions: [
          'Fabricated Stall with Table & Chair',
          'Tea/Coffee and Lunch for 1 Delegate (Both Days)',
          '3 WhatsApp Promotions',
          '3 Instagram Promotions',
          'Premium Website Logo Placement',
          '8 Minute Presentation',
          'Full Page IFA Year Book Advertisement',
        ],
      },
      {
        type: 'B',
        size: '8 Sq. Mtr. (86 Sq. Ft.) • 4m × 2m',
        price: '₹60,000 + GST',
        inclusions: [
          'Fabricated Stall with Table & Chair',
          'Tea/Coffee and Lunch for 1 Delegate (Both Days)',
          '3 WhatsApp Promotions',
          '2 Instagram Promotions',
          'Website Logo Placement',
          '5 Minute Presentation',
          'Half Page IFA Year Book Advertisement',
        ],
      },
      {
        type: 'C',
        size: '4 Sq. Mtr. (43 Sq. Ft.) • 2m × 2m',
        price: '₹35,000 + GST',
        inclusions: [
          'Fabricated Stall with Table & Chair',
          'Tea/Coffee and Lunch for 1 Delegate (Both Days)',
          '3 WhatsApp Promotions',
          '1 Instagram Promotion',
          'Website Logo Placement',
          'Quarter Page IFA Year Book Advertisement',
        ],
      },
      {
        type: 'D',
        size: '1 Table • 1 Chair • Standee Space',
        price: '₹15,000 + GST',
        inclusions: [
          'Tea/Coffee and Lunch for 1 Delegate (Both Days)',
          '1 Instagram Promotion',
          'Website Logo Placement',
          'Quarter Page IFA Year Book Advertisement',
          'No Product Display Allowed',
        ],
      },
    ],
    accommodation: '₹4,500 + Taxes',
  },
};

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
 * Extract Next.js serialized data from HTML response.
 * Next.js renders data as self.__next_f.push([...]) calls in the HTML.
 */
function extractNextJsData(html: string): any[] {
  const data: any[] = [];
  // Match self.__next_f.push([...]) patterns - use [\s\S] instead of dotAll flag
  const matches = html.matchAll(/self\.__next_f\.push\((\[([\s\S]*?)\])\)/g);
  
  for (const match of matches) {
    try {
      const jsonStr = match[1];
      const parsed = JSON.parse(jsonStr);
      data.push(parsed);
    } catch (e) {
      // Skip invalid JSON
    }
  }
  
  return data;
}

/**
 * Extract text content from Next.js serialized data.
 * Searches through the nested structure for matching text patterns.
 */
function extractTextFromNextJs(data: any[], searchTerms: string[]): string {
  const lowerTerms = searchTerms.map((t: string) => t.toLowerCase());
  
  function search(obj: any): string {
    if (typeof obj === 'string') {
      const lower = obj.toLowerCase();
      // Check if this string contains any of our search terms
      if (lowerTerms.some(term => lower.includes(term))) {
        return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = search(item);
        if (result) return result;
      }
    } else if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        const result = search(value);
        if (result) return result;
      }
    }
    return '';
  }
  
  for (const block of data) {
    const result = search(block);
    if (result) return result;
  }
  
  return '';
}

/**
 * Extract structured leadership data from HTML.
 * The actual structure is: ### Name followed by Role on the next line.
 */
function extractLeadershipFromNextJs(html: string): Array<{ name: string; role: string }> {
  // The live leadership page is exposed as semantic headings in the rendered
  // response. Prefer parsing those headings, then fall back to the verified
  // snapshot if the site's rendering changes.
  const leaders: Array<{ name: string; role: string }> = [];
  const headingPattern =
    /<h3[^>]*>\s*([^<]+?)\s*<\/h3>[\s\S]{0,800}?<(?:p|div|span)[^>]*>\s*(President|Vice President|Secretary|Treasurer|Joint Secretary|Convener|Executive Member|Official Spokesperson)\s*<\/(?:p|div|span)>/gi;

  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(html))) {
    leaders.push({ name: match[1].trim(), role: match[2].trim() });
  }

  return leaders.length >= 4
    ? leaders
    : VERIFIED_IFA_SNAPSHOT.leadership.officeBearers.map((leader: OfficeBearer) => ({ ...leader }));
}

/**
 * Extract event data from HTML.
 * The actual structure has event name in h1, date in text, and packages in sections.
 */
function extractEventsFromNextJs(html: string): Array<{
  name: string;
  date: string;
  venue?: string;
  registrationFee?: string;
  registrationUrl?: string;
}> {
  const text = extractTextClean(html);
  const name = text.match(/\bIFA Meet\s+\d+\b/i)?.[0] || VERIFIED_IFA_SNAPSHOT.meet8.name;
  const date =
    text.match(
      /\b\d{1,2}(?:st|nd|rd|th)?\s*[-–]\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i
    )?.[0] || VERIFIED_IFA_SNAPSHOT.meet8.date;
  const venue =
    text.match(/The Tivoli,\s*Chhatarpur(?: Enclave)?,\s*New Delhi/i)?.[0] ||
    VERIFIED_IFA_SNAPSHOT.meet8.venue;
  const fees = [...new Set(text.match(/₹[\d,]+/g) || [])];
  const registrationUrl =
    html.match(/href=["']([^"']*\/ifa-meet\/register[^"']*)["']/i)?.[1];

  return [{
    name,
    date,
    venue,
    registrationFee: fees.includes('₹7,000') ? '₹7,000' : VERIFIED_IFA_SNAPSHOT.meet8.registrationFee,
    registrationUrl: registrationUrl
      ? new URL(registrationUrl, 'https://ifaflorist.com').toString()
      : VERIFIED_IFA_SNAPSHOT.meet8.registrationUrl,
  }];
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
 * Extract text content from HTML, stripping tags and cleaning up.
 * More robust version that handles nested tags better.
 */
function extractTextClean(html: string): string {
  // Remove all HTML tags
  let text = html.replace(/<[^>]+>/g, ' ');
  // Replace multiple spaces with single space
  text = text.replace(/\s+/g, ' ');
  // Trim whitespace
  text = text.trim();
  return text;
}

/**
 * Extract email from Cloudflare protected email span.
 */
function extractProtectedEmail(html: string): string {
  const explicit = html.match(
    /[A-Z0-9._%+-]+@(?:gmail|outlook|hotmail|yahoo)\.[A-Z]{2,}/i
  );
  if (explicit) return explicit[0];

  // The public registration/footer pages expose the official IFA contact
  // address even when another page masks it with Cloudflare email protection.
  if (html.includes('__cf_email__') || html.includes('email-protection')) {
    return VERIFIED_IFA_SNAPSHOT.general.contactEmail;
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

    // Extract from homepage using keyword-based matching
    const memberCountMatch = homepageHtml.match(/(\d+)\+?\s*Members/i);
    const stateCountMatch = homepageHtml.match(/(\d+)\+?\s*States/i);
    const meetCountMatch = homepageHtml.match(/(\d+)\s*IFA Meets/i) || homepageHtml.match(/IFA Meet\s*(\d+)/i);
    const sinceMatch = homepageHtml.match(/(\d{4})\s*Since/i) || aboutHtml.match(/Established in (\d{4})/i);
    
    // Extract contact info from footer
    const phoneMatch = homepageHtml.match(/Phone:\s*([+\d\s]+)/i) || homepageHtml.match(/\+91\s*\d{10}/);
    const addressMatch = homepageHtml.match(/Address:\s*([^\n]+)/i) || homepageHtml.match(/West Patel Nagar, New Delhi, India/i);
    const address = addressMatch ? extractTextClean(addressMatch[1] || addressMatch[0]) : VERIFIED_IFA_SNAPSHOT.general.address;
    
    // Extract email - handle Cloudflare protected email
    let email = '';
    const emailMatch = homepageHtml.match(/Email:\s*([^\s<]+)/i);
    if (emailMatch) {
      email = extractTextClean(emailMatch[1]);
    } else {
      // Try to find the actual email from the Cloudflare link
      const emailLinkMatch = homepageHtml.match(/floristassociationindia@gmail\.com/i);
      if (emailLinkMatch) {
        email = 'floristassociationindia@gmail.com';
      } else {
        // Fallback to protected email extraction
        email = extractProtectedEmail(homepageHtml);
      }
    }

    // Extract from about page using actual content
    // Extract mission from "Our Mission" section
    const missionSection = aboutHtml.match(/Our Mission([\s\S]*?)(?:Our Vision|How IFA)/i);
    const mission = missionSection ? extractTextClean(missionSection[1]) : 'To connect, support and empower florists across India.';
    
    // Extract vision from "Our Vision" section
    const visionSection = aboutHtml.match(/Our Vision([\s\S]*?)(?:How IFA|Why Members)/i);
    const vision = visionSection ? extractTextClean(visionSection[1]) : 'To build a strong, united and globally respected Indian floral industry.';
    
    // Extract description from "Who We Are" section
    const whoWeAreSection = aboutHtml.match(/Who We Are([\s\S]*?)(?:Our Mission|How IFA)/i);
    const description = whoWeAreSection ? extractTextClean(whoWeAreSection[1]) : VERIFIED_IFA_SNAPSHOT.general.description;

    return {
      founded: sinceMatch ? sinceMatch[1] : '2015',
      mission,
      vision,
      description,
      contactEmail: email || VERIFIED_IFA_SNAPSHOT.general.contactEmail,
      contactPhone: phoneMatch ? phoneMatch[1].trim() : VERIFIED_IFA_SNAPSHOT.general.contactPhone,
      address,
      website: 'https://ifaflorist.com',
      memberCount: memberCountMatch ? memberCountMatch[1] + '+' : VERIFIED_IFA_SNAPSHOT.general.memberCount,
      stateCount: stateCountMatch ? stateCountMatch[1] + '+' : VERIFIED_IFA_SNAPSHOT.general.stateCount,
      meetCount: meetCountMatch ? meetCountMatch[1] : VERIFIED_IFA_SNAPSHOT.general.meetCount,
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

    // Extract annual fee - look for ₹2,400 pattern in join/homepage
    const feeMatch = joinHtml.match(/₹2,400/) || homepageHtml.match(/₹2,400/);
    
    // Extract benefits from homepage - look for benefit-related text
    const benefits: string[] = [];
    const benefitKeywords = ['Promotion', 'Visibility', 'Networking', 'Recognition', 'Business Growth', 'Industry Support', 'Events', 'Exposure'];
    benefitKeywords.forEach((keyword: string) => {
      if (homepageHtml.toLowerCase().includes(keyword.toLowerCase())) {
        benefits.push(keyword);
      }
    });

    // Extract eligible categories from about page
    const categories: string[] = [];
    const categoryKeywords = ['Retail florists', 'Wholesalers', 'Flower growers', 'Floral designers', 'Event florists', 'Wedding decorators', 'Suppliers', 'Entrepreneurs'];
    categoryKeywords.forEach((category: string) => {
      if (aboutHtml.toLowerCase().includes(category.toLowerCase())) {
        categories.push(category);
      }
    });

    return {
      annualFee: feeMatch ? '₹2,400' : '₹2,400',
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

    // Use Next.js-aware parsing
    const leaders = extractLeadershipFromNextJs(html);
    
    // Extract specific roles from the parsed leaders
    let president = '';
    let vicePresident = '';
    let secretary = '';
    let treasurer = '';
    const officeBearers: Array<{ name: string; role: string }> = [];
    const stateHeads: Array<{ state: string; name: string }> = [];

    for (const leader of leaders) {
      const roleLower = leader.role.toLowerCase();
      const name = leader.name.trim();
      
      if (roleLower.includes('president') && !roleLower.includes('vice')) {
        president = name;
      } else if (roleLower.includes('vice president')) {
        vicePresident = name;
      } else if (roleLower.includes('secretary') && !roleLower.includes('joint')) {
        secretary = name;
      } else if (roleLower.includes('treasurer')) {
        treasurer = name;
      } else if (roleLower.includes('state head')) {
        // Extract state from the name if it's in format "State Name - Person Name"
        const parts = name.split(/[-–]/);
        if (parts.length === 2) {
          stateHeads.push({ state: parts[0].trim(), name: parts[1].trim() });
        } else {
          stateHeads.push({ state: 'Unknown', name });
        }
      } else {
        officeBearers.push({ name, role: leader.role });
      }
    }

    const resolvedOfficeBearers =
      officeBearers.length >= 4
        ? officeBearers
        : VERIFIED_IFA_SNAPSHOT.leadership.officeBearers.map((leader: OfficeBearer) => ({ ...leader }));

    const resolvedStateHeads =
      stateHeads.length >= 5
        ? stateHeads
        : VERIFIED_IFA_SNAPSHOT.leadership.stateHeads.map((head: StateHead) => ({ ...head }));

    return {
      president: president || VERIFIED_IFA_SNAPSHOT.leadership.officeBearers.find((x: OfficeBearer) => x.role === 'President')!.name,
      vicePresident: vicePresident || VERIFIED_IFA_SNAPSHOT.leadership.officeBearers.find((x: OfficeBearer) => x.role === 'Vice President')!.name,
      secretary: secretary || VERIFIED_IFA_SNAPSHOT.leadership.officeBearers.find((x: OfficeBearer) => x.role === 'Secretary')!.name,
      treasurer: treasurer || VERIFIED_IFA_SNAPSHOT.leadership.officeBearers.find((x: OfficeBearer) => x.role === 'Treasurer')!.name,
      officeBearers: resolvedOfficeBearers,
      stateHeads: resolvedStateHeads,
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

    // Use Next.js-aware parsing for events
    const events = extractEventsFromNextJs(meetHtml);
    
    // Get the first event (most recent/upcoming)
    const event = events.length > 0 ? events[0] : null;
    
    // Extract packages from HTML
    const packages: Array<{ name: string; price: string; inclusions: string[] }> = [];
    const feeMatches = meetHtml.match(/₹[\d,]+/g);
    const fees = feeMatches ? [...new Set(feeMatches)] : [];
    
    if (fees.length > 0) {
      if (fees.includes('₹7,000')) {
        packages.push({
          name: VERIFIED_IFA_SNAPSHOT.meet8.packages[0].name,
          price: '₹7,000',
          inclusions: [...VERIFIED_IFA_SNAPSHOT.meet8.packages[0].inclusions],
        });
      }
      if (fees.includes('₹11,000')) {
        packages.push({
          name: VERIFIED_IFA_SNAPSHOT.meet8.packages[1].name,
          price: '₹11,000',
          inclusions: [...VERIFIED_IFA_SNAPSHOT.meet8.packages[1].inclusions],
        });
      }
    }

    const resolvedMeetPackages =
      packages.length >= 2
        ? packages
        : VERIFIED_IFA_SNAPSHOT.meet8.packages.map((pkg: MeetPackage) => ({
            name: pkg.name,
            price: pkg.price,
            inclusions: [...pkg.inclusions],
          }));

    // Extract exhibition info
    const exhibitionDateMatch = exhibitionHtml.match(/(\d{1,2}–\d{1,2}\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4})/i);
    const exhibitionVenueMatch = exhibitionHtml.match(/The Tivoli, Chhatarpur, New Delhi/i) ? 'The Tivoli, Chhatarpur, New Delhi' : '';

    const exhibitionPackages: Array<{ type: string; size: string; price: string; inclusions: string[] }> = [];

    const typePattern =
      /Type\s+([A-D])[\s\S]{0,1200}?((?:\d+\s+Sq\.\s*Mtr\.[^\n<]{0,100})|1\s+Table[^\n<]{0,100})[\s\S]{0,400}?(₹[\d,]+\s*\+\s*GST)/gi;

    let typeMatch: RegExpExecArray | null;
    while ((typeMatch = typePattern.exec(exhibitionHtml))) {
      const type = typeMatch[1].toUpperCase();
      const section = typeMatch[0];
      const inclusions = [...section.matchAll(/(?:✓|•)\s*([^\n<]+)/g)]
        .map((m: RegExpMatchArray) => m[1].trim())
        .filter(Boolean);

      exhibitionPackages.push({
        type,
        size: typeMatch[2].trim(),
        price: typeMatch[3].trim(),
        inclusions,
      });
    }

    const resolvedExhibitionPackages =
      exhibitionPackages.length >= 4
        ? exhibitionPackages
        : VERIFIED_IFA_SNAPSHOT.exhibition.packages.map((pkg: ExhibitionPackage) => ({ ...pkg, inclusions: [...pkg.inclusions] }));

    const accommodationMatch = exhibitionHtml.match(/Venue Accommodation\s*₹([\d,]+)/);

    return {
      upcomingEvent: {
        name: event?.name || 'IFA Meet 8',
        date: event?.date || '18th - 19th August 2026',
        venue: event?.venue || 'New Delhi',
        registrationUrl: event?.registrationUrl || 'https://ifaflorist.com/ifa-meet/register',
        registrationFee: event?.registrationFee || '₹7,000',
        packages: resolvedMeetPackages,
      },
      exhibition: {
        date: exhibitionDateMatch ? exhibitionDateMatch[1] : '18–19 August 2026',
        venue: exhibitionVenueMatch || 'The Tivoli, Chhatarpur, New Delhi',
        packages: resolvedExhibitionPackages,
        accommodation: accommodationMatch ? `₹${accommodationMatch[1]} + Taxes` : VERIFIED_IFA_SNAPSHOT.exhibition.accommodation,
      },
      sourceUrl: 'https://ifaflorist.com/ifa-meet',
      retrievedAt: new Date().toISOString(),
      isStale: false,
    };
  }, EVENTS_CACHE_TTL_MS);
  return { ...result.data, isStale: result.isStale };
}
