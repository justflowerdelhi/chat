export type SupportedLanguage = 'en' | 'hi' | 'hinglish';

const HINDI_UNICODE = /[\u0900-\u097F]/;

export function detectLanguage(text: string): SupportedLanguage {
  if (!text || typeof text !== 'string') {
    return 'en';
  }

  const hasHindi = HINDI_UNICODE.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasHindi && hasLatin) {
    return 'hinglish';
  }

  if (hasHindi) {
    return 'hi';
  }

  return 'en';
}
