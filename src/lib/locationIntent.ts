const CITY_NAMES = [
  'New Delhi',
  'Delhi',
  'Mumbai',
  'Bombay',
  'Bengaluru',
  'Bangalore',
  'Kolkata',
  'Calcutta',
  'Chennai',
  'Hyderabad',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Gurugram',
  'Gurgaon',
  'Noida',
  'Ghaziabad',
  'Chandigarh',
  'Nagpur',
];

const cityPattern = new RegExp(
  '\\b(' + CITY_NAMES.map((city) => city.replace(/ /g, '\\s+')).join('|') + ')\\b',
  'i'
);

const pincodePattern = /\b\d{6}\b/;

const intentPatterns = [
  /\b(nearest|closest|najdik)\s+(?:a\s+|the\s+)?(?:ifa\s+)?(?:florist|florists|flower shop|flower shops)\b/,
  /\b(?:ifa\s+)?(?:florist|florists|flower shop|flower shops)\s+(?:near(?:by)?\s+me|najdik|paas)\b/,
  /\bfind\s+(?:a\s+|the\s+)?(?:ifa\s+)?(?:florist|florists|flower shop|flower shops)\s+(?:near|in|at)\b/,
  /\b(?:which|where)\s+(?:is\s+|are\s+)?(?:the\s+)?(?:nearest|closest|najdik)?\s*(?:ifa\s+)?(?:florist|florists|flower shop|flower shops)\b/,
];

export function detectNearestFloristIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return intentPatterns.some((pattern) => pattern.test(normalized));
}

export function extractLocationFromMessage(text: string): {
  city?: string;
  pincode?: string;
} {
  const location: { city?: string; pincode?: string } = {};

  const pincodeMatch = text.match(pincodePattern);
  if (pincodeMatch) {
    location.pincode = pincodeMatch[0];
  }

  const cityMatch = text.match(cityPattern);
  if (cityMatch) {
    location.city = cityMatch[0];
  }

  // If we have a pincode but no city from the known list, try to extract
  // an adjacent city name from the text
  if (location.pincode && !location.city) {
    const extractedCity = extractCityNearPincode(text, location.pincode);
    if (extractedCity) {
      location.city = extractedCity;
    }
  }

  return location;
}

// Words that should not be treated as city names
const NON_CITY_WORDS = new Set([
  'pincode', 'pin', 'code', 'zip', 'postal',
  'nearest', 'closest', 'near', 'in', 'at', 'for',
  'florist', 'florists', 'flower', 'flowers', 'shop', 'shops',
  'find', 'show', 'get', 'need', 'want', 'give',
  'the', 'a', 'an', 'is', 'are', 'to', 'from',
  'please', 'thanks', 'thank', 'you',
  'area', 'location', 'place', 'region',
  'check', 'search', 'look',
  'india', 'today', 'tomorrow', 'yesterday', 'now', 'here', 'there',
]);

function extractCityNearPincode(text: string, pincode: string): string | undefined {
  // Find the position of the pincode in the text
  const pincodeIndex = text.indexOf(pincode);
  if (pincodeIndex === -1) return undefined;

  // Priority B: Explicit delimiter-separated location (strongest signal)
  // Check for comma, dash, or slash (with optional spaces) before or after the pincode
  const charBefore = pincodeIndex > 0 ? text[pincodeIndex - 1] : '';
  const charAfter = pincodeIndex + pincode.length < text.length ? text[pincodeIndex + pincode.length] : '';

  // Check for delimiter after pincode: "800003, Patna" or "800003 - Patna" or "800003 / Patna"
  if (charAfter === ',' || charAfter === '-' || charAfter === '/') {
    const afterDelimiter = text.slice(pincodeIndex + pincode.length + 1).trim();
    const match = afterDelimiter.match(/^([A-Za-z]+)/);
    if (match) {
      const city = match[1];
      if (city.length >= 3 && !NON_CITY_WORDS.has(city.toLowerCase())) {
        return capitalizeCity(city);
      }
    }
  }

  // Check for delimiter before pincode: "Patna, 800003" or "Patna - 800003" or "Patna / 800003"
  if (charBefore === ',' || charBefore === '-' || charBefore === '/') {
    const beforeDelimiter = text.slice(0, pincodeIndex - 1).trim();
    const words = beforeDelimiter.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord && lastWord.length >= 3 && !NON_CITY_WORDS.has(lastWord.toLowerCase())) {
      return capitalizeCity(lastWord);
    }
  }

  // Check for space + delimiter after pincode: "800003 , Patna" or "800003 - Patna"
  if (pincodeIndex + pincode.length + 1 < text.length) {
    const afterSpace = text[pincodeIndex + pincode.length + 1];
    if (afterSpace === ',' || afterSpace === '-' || afterSpace === '/') {
      const afterDelimiter = text.slice(pincodeIndex + pincode.length + 2).trim();
      const match = afterDelimiter.match(/^([A-Za-z]+)/);
      if (match) {
        const city = match[1];
        if (city.length >= 3 && !NON_CITY_WORDS.has(city.toLowerCase())) {
          return capitalizeCity(city);
        }
      }
    }
  }

  // Check for delimiter + space before pincode: "Patna , 800003" or "Patna - 800003"
  if (pincodeIndex > 1) {
    const beforeSpace = text[pincodeIndex - 2];
    if (beforeSpace === ',' || beforeSpace === '-' || beforeSpace === '/') {
      const beforeDelimiter = text.slice(0, pincodeIndex - 2).trim();
      const words = beforeDelimiter.split(/\s+/);
      const lastWord = words[words.length - 1];
      if (lastWord && lastWord.length >= 3 && !NON_CITY_WORDS.has(lastWord.toLowerCase())) {
        return capitalizeCity(lastWord);
      }
    }
  }

  // Priority C: Explicit location phrasing with comma
  // "in 800003, Patna", "near 800003, Patna", "for 800003, Patna", "pincode 800003, Patna"
  const locationPhrases = ['in', 'near', 'for', 'at', 'pincode', 'pin'];
  for (const phrase of locationPhrases) {
    const pattern = new RegExp(`\\b${phrase}\\s+${pincode}\\s*,\\s*([A-Za-z]+)`, 'i');
    const match = text.match(pattern);
    if (match) {
      const city = match[1];
      if (city.length >= 3 && !NON_CITY_WORDS.has(city.toLowerCase())) {
        return capitalizeCity(city);
      }
    }
  }

  // Priority C2: Explicit location phrasing without comma (space-separated)
  // "near 800003 Patna", "in 800003 Patna", "for 800003 Patna"
  for (const phrase of locationPhrases) {
    const pattern = new RegExp(`\\b${phrase}\\s+${pincode}\\s+([A-Za-z]+)`, 'i');
    const match = text.match(pattern);
    if (match) {
      const city = match[1];
      if (city.length >= 3 && !NON_CITY_WORDS.has(city.toLowerCase())) {
        return capitalizeCity(city);
      }
    }
  }

  // Priority D: Space-separated city + PIN (weaker signal, but still useful)
  // "800003 Patna" or "Patna 800003"
  // Only extract if the adjacent word looks like a proper city name (capitalized, reasonable length)
  const contextStart = Math.max(0, pincodeIndex - 30);
  const contextEnd = Math.min(text.length, pincodeIndex + pincode.length + 30);
  const context = text.slice(contextStart, contextEnd);

  const words = context.split(/[\s,]+/).filter(w => w.length > 0);
  const pincodeWordIndex = words.findIndex(w => w.includes(pincode));
  if (pincodeWordIndex === -1) return undefined;

  // Check word before pincode
  if (pincodeWordIndex > 0) {
    const beforeWord = words[pincodeWordIndex - 1].replace(/[,，]/g, '').trim();
    if (beforeWord && beforeWord.length >= 3 && !NON_CITY_WORDS.has(beforeWord.toLowerCase()) && !/^\d+$/.test(beforeWord)) {
      // Only accept if it looks like a proper city name (starts with capital letter)
      if (/^[A-Z][a-z]+$/.test(beforeWord)) {
        return capitalizeCity(beforeWord);
      }
    }
  }

  // Check word after pincode
  if (pincodeWordIndex < words.length - 1) {
    const afterWord = words[pincodeWordIndex + 1].replace(/[,，]/g, '').trim();
    if (afterWord && afterWord.length >= 3 && !NON_CITY_WORDS.has(afterWord.toLowerCase()) && !/^\d+$/.test(afterWord)) {
      // Only accept if it looks like a proper city name (starts with capital letter)
      if (/^[A-Z][a-z]+$/.test(afterWord)) {
        return capitalizeCity(afterWord);
      }
    }
  }

  // Priority E: No fallback - if no strong signal, return undefined
  return undefined;
}

function capitalizeCity(city: string): string {
  if (!city) return city;
  // Capitalize first letter, lowercase the rest
  return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
}

const contactDetailPatterns = [
  /\b(show|give|send|share|get|need|want).{0,25}\b(contact details|details|phone number|contact no|phone no|number|address)\b/,
  /\b(?<!\b(?:your|my|our)\s)(?:contact details|phone number|contact no|phone no|the number|address)\b/,
  /\b(call|phone|contact)\s+(?:the\s+)?(?:nearest|first|that)?\s*(?:florist|flower shop|one|shop)\b/,
  /\bwhere\s+(?:is\sit|is\sthe|is\sthat)\b/,
  /\bnearest\s+(?:one|florist|flower shop).{0,20}(?:contact|phone|address|number|details)\b/,
];

export function hasLocationInformation(text: string): boolean {
  const location = extractLocationFromMessage(text);
  return Boolean(location.city || location.pincode);
}

export function detectContactDetailsRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  return contactDetailPatterns.some((pattern) => pattern.test(normalized));
}

export function isAffirmativeReply(text: string): boolean {
  return /^\s*(yes|yeah|sure|please|ok|okay|yup|yep)(\s+please)?\s*$/i.test(text.trim());
}

export function buildMissingLocationMessage(location: {
  city?: string;
  pincode?: string;
}): string {
  if (!location.pincode && !location.city) {
    return 'Sure 😊 Which area or PIN code should I check?';
  }

  if (location.pincode && !location.city) {
    return 'Thanks 😊 Which city is this PIN code in?';
  }

  return 'Sure 😊 Please share the PIN code so I can find the nearest IFA florists.';
}
