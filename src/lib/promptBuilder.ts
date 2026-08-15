import {
  getBusinessProfile,
  getFAQs,
  getUnifiedCatalogProducts,
  getCustomerProfile,
  getAISettings,
  type AISettings,
} from '@/lib/floristData';
import { FLORIST_MITRA_PROMPT } from '@/lib/floristPrompt';

interface BuildPromptOptions {
  memberId: number;
  customerPhone: string;
  currentMessage: string;
  deliveryCity?: string;
  language?: string;
}

interface BuildPromptResult {
  prompt: string;
  settings: AISettings | null;
}

function clean(value: string | null | undefined, fallback = ''): string {
  return value?.trim() || fallback;
}

export async function buildPrompt(options: BuildPromptOptions): Promise<BuildPromptResult> {
  const { memberId, customerPhone, currentMessage, deliveryCity } = options;

  const [business, faqs, products, customer, settings] = await Promise.all([
    getBusinessProfile(memberId),
    getFAQs(memberId),
    getUnifiedCatalogProducts(memberId, { featured: true, limit: 20 }),
    getCustomerProfile(memberId, customerPhone),
    getAISettings(memberId),
  ]);

  const profile = business || {} as { business_name?: string | null };
  const businessName = clean(profile.business_name, 'your florist');
  const effectiveLanguage = clean(options.language, clean(settings?.language, 'en'));
  const language = effectiveLanguage === 'hi' ? 'Hindi' : effectiveLanguage === 'hinglish' ? 'Hinglish' : 'English';

  const sections: string[] = [];

  sections.push(`You are the AI WhatsApp Sales Assistant for ${businessName}.`);
  sections.push(`Base language for this conversation: ${language}.`);
  sections.push(`Current date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`);
  if (deliveryCity) {
    sections.push(`Customer delivery city (if mentioned): ${deliveryCity}.`);
  }

  if (business) {
    sections.push(`\nBUSINESS PROFILE:`);
    if (business.tagline) sections.push(`Tagline: ${business.tagline}`);
    if (business.description) sections.push(`Description: ${business.description}`);
    if (business.working_hours) sections.push(`Working hours: ${business.working_hours}`);
    if (business.delivery_areas) sections.push(`Delivery areas: ${business.delivery_areas}`);
    if (business.delivery_charges) sections.push(`Delivery charges: ${business.delivery_charges}`);
    if (business.emergency_delivery) sections.push(`Emergency delivery is available.`);
    if (business.midnight_delivery) sections.push(`Midnight delivery is available.`);
    if (business.address) sections.push(`Store address: ${business.address}`);
    if (business.phone_numbers) sections.push(`Store phone: ${business.phone_numbers}`);
    if (business.email) sections.push(`Store email: ${business.email}`);
    if (business.greeting_message) sections.push(`Greeting to use: "${business.greeting_message}"`);
    if (business.closing_message) sections.push(`Closing message to use: "${business.closing_message}"`);
    if (business.cancellation_policy) sections.push(`Cancellation policy: ${business.cancellation_policy}`);
    if (business.refund_policy) sections.push(`Refund policy: ${business.refund_policy}`);
    if (business.customization_policy) sections.push(`Customization policy: ${business.customization_policy}`);
  }

  if (customer) {
    sections.push(`\nCUSTOMER MEMORY:`);
    if (customer.name) sections.push(`Name: ${customer.name}`);
    if (customer.budget) sections.push(`Budget preference: ${customer.budget}`);
    if (customer.favourite_flowers) sections.push(`Favourite flowers: ${customer.favourite_flowers}`);
    if (customer.favourite_colours) sections.push(`Favourite colours: ${customer.favourite_colours}`);
    if (customer.occasions) sections.push(`Known occasions: ${customer.occasions}`);
    if (customer.delivery_address) sections.push(`Delivery address: ${customer.delivery_address}`);
    if (customer.last_purchase) sections.push(`Last purchase: ${customer.last_purchase}`);
    if (customer.open_quote) sections.push(`Open quote: ${customer.open_quote}`);
    if (customer.last_ai_summary) sections.push(`Last conversation summary: ${customer.last_ai_summary}`);
  }

  if (products.length > 0) {
    sections.push(`\nFEATURED DESIGN GALLERY & CATALOG (recommend from these only):`);
    for (const product of products) {
      const line = `- ${product.name}${product.price ? ` - ₹${product.price}` : ''}`
        + `${product.description ? `: ${product.description}` : ''}`
        + `${product.occasion ? ` (${product.occasion})` : ''}`
        + `${product.image_url ? ` [Image: ${product.image_url}]` : ''}`
        + ` [Source: ${product.source || 'manual_catalog'}]`;
      sections.push(line);
    }
  }

  if (faqs.length > 0) {
    sections.push(`\nFAQ REFERENCE (answer from these first when relevant):`);
    for (const faq of faqs.slice(0, 15)) {
      sections.push(`Q: ${faq.question}\nA: ${faq.answer}`);
    }
  }

  if (settings) {
    sections.push(`\nAI BEHAVIOUR:`);
    sections.push(`- Tone: ${settings.creativity}`);
    sections.push(`- Emoji level: ${settings.emoji_level}`);
    sections.push(`- Maximum reply length: ${settings.max_reply_length} characters`);
    sections.push(`- Quote style: ${settings.quote_style}`);
    if (settings.greeting) sections.push(`- Default greeting: ${settings.greeting}`);
  }

  sections.push(`\nCUSTOMER'S CURRENT MESSAGE: ${currentMessage}`);

  const prompt = [FLORIST_MITRA_PROMPT.trim(), ...sections].join('\n\n');
  return { prompt, settings };
}
