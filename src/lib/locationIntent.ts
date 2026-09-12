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

  return location;
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
