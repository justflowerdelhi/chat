'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/db';
import {
  saveBusinessProfile,
  saveAISettings,
  createFAQ,
  createCatalogProduct,
} from '@/app/admin/actions';

async function requireMemberId(): Promise<number> {
  const user = await getCurrentUser();
  if (!user?.member_id) {
    throw new Error('Unauthorized');
  }
  return user.member_id;
}

export async function getMe() {
  const user = await getCurrentUser();
  return user ? { id: user.id, name: user.name, email: user.email, memberId: user.member_id } : null;
}

export async function getWhatsAppPhone() {
  const memberId = await requireMemberId();
  const result = await pool.query<{ display_phone: string | null }>(
    'SELECT display_phone FROM whatsapp_connections WHERE member_id = $1 AND status = $2 ORDER BY updated_at DESC LIMIT 1',
    [memberId, 'active']
  );
  return result.rows[0]?.display_phone || null;
}

export interface SetupData {
  business: Record<string, unknown> | null;
  faqs: Record<string, unknown>[];
  catalog: Record<string, unknown>[];
  designGallery: Record<string, unknown> | null;
  catalogSource: Record<string, unknown> | null;
  ai: Record<string, unknown> | null;
  phone: string | null;
}

export async function getSetupData(): Promise<SetupData> {
  const memberId = await requireMemberId();
  const [business, faqs, catalog, designCount, source, ai, phone] = await Promise.all([
    pool.query('SELECT * FROM business_profiles WHERE member_id = $1 LIMIT 1', [memberId]).then((r) => r.rows[0] || null),
    pool.query('SELECT * FROM faqs WHERE member_id = $1 ORDER BY priority DESC, created_at ASC', [memberId]).then((r) => r.rows),
    pool.query('SELECT * FROM catalog_products WHERE member_id = $1 ORDER BY featured DESC, created_at DESC', [memberId]).then((r) => r.rows),
    pool.query('SELECT COUNT(*)::int as count FROM design_gallery WHERE member_id = $1', [memberId]).then((r) => r.rows[0] || null),
    pool.query('SELECT source, status, last_synced_at FROM catalog_sources WHERE member_id = $1 LIMIT 1', [memberId]).then((r) => r.rows[0] || null),
    pool.query('SELECT * FROM ai_settings WHERE member_id = $1 LIMIT 1', [memberId]).then((r) => r.rows[0] || null),
    getWhatsAppPhone(),
  ]);
  const designGallery = designCount ? { ...designCount, available: (designCount.count as number) > 0 } : { count: 0, available: false };
  return { business, faqs, catalog, designGallery, catalogSource: source, ai, phone };
}

interface BusinessStep {
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  delivery_areas: string;
  working_hours: string;
}

interface ServicesStep {
  same_day_available: boolean;
  midnight_delivery: boolean;
  emergency_delivery: boolean;
  delivery_charges: string;
  customization_available: boolean;
  pickup_available: boolean;
  wedding_orders: boolean;
  corporate_orders: boolean;
  payment_methods: string;
  upi_id: string;
  gst_number: string;
  cancellation_policy: string;
  refund_policy: string;
}

interface FAQItem {
  question: string;
  answer: string;
  category: string;
  priority: number;
}

interface AIStep {
  tone: 'conservative' | 'balanced' | 'creative';
  language: 'en' | 'hi' | 'hinglish';
  emoji_level: 'none' | 'low' | 'medium' | 'high';
  greeting: string;
}

interface CatalogItem {
  name: string;
  price: number;
  description: string;
  occasion: string;
  flower_types: string;
  color: string;
  style: string;
  image_url: string;
  categories: string;
  availability: boolean;
  featured: boolean;
  same_day: boolean;
}

export interface CompleteSetupPayload {
  business: BusinessStep;
  services: ServicesStep;
  faqs: FAQItem[];
  catalog: CatalogItem[];
  ai: AIStep;
}

function buildBusinessDescription(business: BusinessStep, services: ServicesStep) {
  const parts = [
    business.business_name ? `${business.business_name} is a florist serving ${business.delivery_areas || 'our local area'}.` : '',
    business.contact_person ? `Contact person: ${business.contact_person}.` : '',
    business.phone ? `Phone: ${business.phone}.` : '',
    business.email ? `Email: ${business.email}.` : '',
    business.website ? `Website: ${business.website}.` : '',
    business.working_hours ? `Working hours: ${business.working_hours}.` : '',
    business.address ? `Store address: ${business.address}, ${business.city}.` : '',
    services.delivery_charges ? `Delivery charges: ${services.delivery_charges}.` : '',
    services.payment_methods ? `Payment methods: ${services.payment_methods}.` : '',
    services.upi_id ? `UPI ID: ${services.upi_id}.` : '',
    services.gst_number ? `GST: ${services.gst_number}.` : '',
    services.same_day_available ? 'Same-day delivery is available.' : 'Same-day delivery is not available.',
    services.midnight_delivery ? 'Midnight delivery is available.' : 'Midnight delivery is not available.',
    services.emergency_delivery ? 'Emergency delivery is available.' : 'Emergency delivery is not available.',
    services.customization_available ? 'Bouquet customisation is available.' : 'Bouquet customisation is not available.',
    services.pickup_available ? 'In-store pickup is available.' : 'In-store pickup is not available.',
    services.wedding_orders ? 'We accept wedding and event orders.' : 'Wedding and event orders are not accepted.',
    services.corporate_orders ? 'We accept corporate orders.' : 'Corporate orders are not accepted.',
    services.cancellation_policy ? `Cancellation policy: ${services.cancellation_policy}.` : '',
    services.refund_policy ? `Refund policy: ${services.refund_policy}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

export async function generateDefaultFAQs(business: Record<string, unknown>, services: ServicesStep): Promise<FAQItem[]> {
  const b = business as unknown as BusinessStep;
  const name = b.business_name || 'our store';
  const sameDay = services.same_day_available;
  const midnight = services.midnight_delivery;
  const emergency = services.emergency_delivery;
  const custom = services.customization_available;
  const pickup = services.pickup_available;
  const wedding = services.wedding_orders;
  const corporate = services.corporate_orders;

  return [
    { question: 'How can I place an order?', answer: `You can place an order with ${name} through WhatsApp. Share what you need and we will guide you.`, category: 'Ordering', priority: 10 },
    { question: 'Do you offer same-day delivery?', answer: sameDay ? 'Yes, same-day delivery is available with us.' : 'Same-day delivery is currently not available.', category: 'Delivery', priority: 10 },
    { question: 'What are your delivery timings?', answer: `Our working hours are ${b.working_hours || 'as shared on our profile'}. Deliveries are scheduled accordingly.`, category: 'Delivery', priority: 9 },
    { question: 'Which areas do you deliver to?', answer: `We deliver to ${b.delivery_areas || 'our local service areas'}.`, category: 'Delivery', priority: 9 },
    { question: 'Do you deliver at midnight?', answer: midnight ? 'Yes, midnight delivery is available.' : 'Midnight delivery is currently not available.', category: 'Delivery', priority: 8 },
    { question: 'Can I customise a bouquet?', answer: custom ? 'Yes, bouquet customisation is available. Let us know your preferences.' : 'Bouquet customisation is currently not available.', category: 'Customisation', priority: 8 },
    { question: 'Are fresh flowers available today?', answer: 'Yes, we usually stock fresh flowers. Please confirm availability for a specific bouquet.', category: 'Flowers', priority: 7 },
    { question: 'What payment methods do you accept?', answer: services.payment_methods ? `We accept ${services.payment_methods}.` : 'Please ask us about accepted payment methods.', category: 'Payment', priority: 8 },
    { question: 'Can I cancel my order?', answer: services.cancellation_policy ? `Cancellation: ${services.cancellation_policy}` : 'Please contact us for cancellation requests.', category: 'Cancellation', priority: 7 },
    { question: 'What is your refund policy?', answer: services.refund_policy ? `Refund: ${services.refund_policy}` : 'Refund requests are reviewed case by case. Please contact us.', category: 'Refund', priority: 7 },
    { question: 'How will I know my order is confirmed?', answer: 'We will confirm your order and share details over WhatsApp.', category: 'Ordering', priority: 6 },
    { question: 'What are the delivery charges?', answer: services.delivery_charges ? `Delivery charges: ${services.delivery_charges}.` : 'Please ask us for the delivery charges.', category: 'Delivery', priority: 8 },
    { question: 'Can I pick up my order from the store?', answer: pickup ? 'Yes, in-store pickup is available.' : 'In-store pickup is currently not available.', category: 'Pickup', priority: 6 },
    { question: 'Do you take wedding orders?', answer: wedding ? 'Yes, we accept wedding and event orders.' : 'Wedding and event orders are currently not accepted.', category: 'Wedding', priority: 6 },
    { question: 'Do you take corporate orders?', answer: corporate ? 'Yes, we accept corporate orders.' : 'Corporate orders are currently not accepted.', category: 'Corporate', priority: 6 },
    { question: 'How can I contact you?', answer: `You can reach us on WhatsApp ${b.phone ? `at ${b.phone}` : ''}${b.email ? ` or email ${b.email}` : ''}.`, category: 'General', priority: 10 },
    { question: 'Do you have products for special occasions?', answer: 'Yes, we can help you find flowers for birthdays, anniversaries, weddings and more.', category: 'Flowers', priority: 5 },
    { question: 'Can I request a special arrangement?', answer: custom ? 'Yes, tell us your idea and we will prepare a special arrangement.' : 'Special requests may be limited. Please ask us to confirm.', category: 'Customisation', priority: 5 },
  ];
}

export async function completeSetup(payload: CompleteSetupPayload) {
  const memberId = await requireMemberId();

  const description = buildBusinessDescription(payload.business, payload.services);

  await saveBusinessProfile({
    business_name: payload.business.business_name,
    phone_numbers: payload.business.phone,
    email: payload.business.email,
    website: payload.business.website,
    address: `${payload.business.address}${payload.business.city ? `, ${payload.business.city}` : ''}`,
    city: payload.business.city,
    contact_person: payload.business.contact_person,
    delivery_areas: payload.business.delivery_areas,
    working_hours: payload.business.working_hours,
    delivery_charges: payload.services.delivery_charges,
    emergency_delivery: payload.services.emergency_delivery,
    midnight_delivery: payload.services.midnight_delivery,
    same_day_available: payload.services.same_day_available,
    customization_available: payload.services.customization_available,
    pickup_available: payload.services.pickup_available,
    wedding_orders: payload.services.wedding_orders,
    corporate_orders: payload.services.corporate_orders,
    payment_methods: payload.services.payment_methods,
    upi_id: payload.services.upi_id,
    gst_number: payload.services.gst_number,
    cancellation_policy: payload.services.cancellation_policy,
    refund_policy: payload.services.refund_policy,
    customization_policy: payload.services.customization_available ? 'Bouquet customisation is available on request.' : 'Bouquet customisation is not available.',
    description,
    greeting_message: `Hello! Welcome to ${payload.business.business_name}.`,
    closing_message: "I'll pass these details to our florist who will contact you shortly.",
  });

  for (const faq of payload.faqs) {
    await createFAQ(faq);
  }

  for (const product of payload.catalog) {
    await createCatalogProduct({
      ...product,
      premium: false,
      luxury: false,
      budget: false,
    });
  }

  await saveAISettings({
    temperature: 0.7,
    model: 'gpt-4o-mini',
    creativity: payload.ai.tone,
    greeting: payload.ai.greeting || `Hello! Welcome to ${payload.business.business_name}. How can I help you today?`,
    language: payload.ai.language,
    emoji_level: payload.ai.emoji_level,
    max_reply_length: 250,
    quote_style: 'friendly',
  });

  await pool.query(
    'INSERT INTO human_takeover (member_id, active, taken_by, started_at) VALUES ($1, false, NULL, NULL) ON CONFLICT (member_id) DO NOTHING',
    [memberId]
  );

  revalidatePath('/setup');
  revalidatePath('/admin');
  return { ok: true };
}

export async function setCatalogSource(source: 'design_gallery' | 'manual_catalog') {
  const memberId = await requireMemberId();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO catalog_sources (member_id, source, status, connected_at, last_synced_at)
     VALUES ($1, $2, 'connected', $3, $3)
     ON CONFLICT (member_id) DO UPDATE SET
       source = EXCLUDED.source,
       status = 'connected',
       connected_at = COALESCE(catalog_sources.connected_at, EXCLUDED.connected_at),
       last_synced_at = $3,
       updated_at = NOW()`,
    [memberId, source, now]
  );
  revalidatePath('/setup');
  revalidatePath('/admin');
}

export async function connectDesignGallery() {
  const memberId = await requireMemberId();
  const now = new Date().toISOString();
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
  revalidatePath('/setup');
  revalidatePath('/admin');
  return { ok: true };
}
