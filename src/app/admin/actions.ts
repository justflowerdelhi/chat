'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import pool from '@/lib/db';
import { syncDesignGalleryForMember } from '@/lib/designGallerySync';

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

// Business Profile
export interface BusinessProfileData {
  business_name?: string;
  tagline?: string;
  description?: string;
  address?: string;
  city?: string;
  contact_person?: string;
  google_maps_url?: string;
  working_hours?: string;
  delivery_areas?: string;
  delivery_charges?: string;
  emergency_delivery?: boolean;
  midnight_delivery?: boolean;
  same_day_available?: boolean;
  customization_available?: boolean;
  pickup_available?: boolean;
  wedding_orders?: boolean;
  corporate_orders?: boolean;
  payment_methods?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  upi_id?: string;
  gst_number?: string;
  phone_numbers?: string;
  email?: string;
  cancellation_policy?: string;
  refund_policy?: string;
  customization_policy?: string;
  greeting_message?: string;
  closing_message?: string;
}

export async function getBusinessProfile() {
  const memberId = await requireMemberId();
  const result = await pool.query(
    'SELECT * FROM business_profiles WHERE member_id = $1 LIMIT 1',
    [memberId]
  );
  return result.rows[0] || null;
}

export async function saveBusinessProfile(data: BusinessProfileData) {
  const memberId = await requireMemberId();

  const existing = await pool.query(
    'SELECT id FROM business_profiles WHERE member_id = $1',
    [memberId]
  );

  if (existing.rowCount === 0) {
    await pool.query(
      `INSERT INTO business_profiles (
        member_id, business_name, tagline, description, address, google_maps_url,
        working_hours, delivery_areas, delivery_charges, emergency_delivery, midnight_delivery,
        website, instagram, facebook, upi_id, gst_number, phone_numbers, email,
        cancellation_policy, refund_policy, customization_policy, greeting_message, closing_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        memberId,
        data.business_name || null,
        data.tagline || null,
        data.description || null,
        data.address || null,
        data.google_maps_url || null,
        data.working_hours || null,
        data.delivery_areas || null,
        data.delivery_charges || null,
        data.emergency_delivery ?? false,
        data.midnight_delivery ?? false,
        data.website || null,
        data.instagram || null,
        data.facebook || null,
        data.upi_id || null,
        data.gst_number || null,
        data.phone_numbers || null,
        data.email || null,
        data.cancellation_policy || null,
        data.refund_policy || null,
        data.customization_policy || null,
        data.greeting_message || null,
        data.closing_message || null,
      ]
    );
  } else {
    await pool.query(
      `UPDATE business_profiles SET
        business_name = $2, tagline = $3, description = $4, address = $5, google_maps_url = $6,
        working_hours = $7, delivery_areas = $8, delivery_charges = $9, emergency_delivery = $10, midnight_delivery = $11,
        website = $12, instagram = $13, facebook = $14, upi_id = $15, gst_number = $16, phone_numbers = $17, email = $18,
        cancellation_policy = $19, refund_policy = $20, customization_policy = $21, greeting_message = $22, closing_message = $23,
        updated_at = NOW()
      WHERE member_id = $1`,
      [
        memberId,
        data.business_name || null,
        data.tagline || null,
        data.description || null,
        data.address || null,
        data.google_maps_url || null,
        data.working_hours || null,
        data.delivery_areas || null,
        data.delivery_charges || null,
        data.emergency_delivery ?? false,
        data.midnight_delivery ?? false,
        data.website || null,
        data.instagram || null,
        data.facebook || null,
        data.upi_id || null,
        data.gst_number || null,
        data.phone_numbers || null,
        data.email || null,
        data.cancellation_policy || null,
        data.refund_policy || null,
        data.customization_policy || null,
        data.greeting_message || null,
        data.closing_message || null,
      ]
    );
  }

  revalidatePath('/admin');
}

// FAQ
export interface FAQData {
  question: string;
  answer: string;
  category?: string;
  priority?: number;
}

export async function getFAQs() {
  const memberId = await requireMemberId();
  const result = await pool.query(
    'SELECT * FROM faqs WHERE member_id = $1 ORDER BY priority DESC, created_at ASC',
    [memberId]
  );
  return result.rows;
}

export async function createFAQ(data: FAQData) {
  const memberId = await requireMemberId();
  await pool.query(
    'INSERT INTO faqs (member_id, question, answer, category, priority) VALUES ($1, $2, $3, $4, $5)',
    [memberId, data.question, data.answer, data.category || 'general', data.priority ?? 0]
  );
  revalidatePath('/admin');
}

export async function updateFAQ(id: string, data: FAQData) {
  const memberId = await requireMemberId();
  await pool.query(
    'UPDATE faqs SET question = $2, answer = $3, category = $4, priority = $5, updated_at = NOW() WHERE id = $1 AND member_id = $6',
    [id, data.question, data.answer, data.category || 'general', data.priority ?? 0, memberId]
  );
  revalidatePath('/admin');
}

export async function deleteFAQ(id: string) {
  const memberId = await requireMemberId();
  await pool.query('DELETE FROM faqs WHERE id = $1 AND member_id = $2', [id, memberId]);
  revalidatePath('/admin');
}

// Catalog
export interface CatalogProductData {
  name: string;
  price?: number;
  description?: string;
  occasion?: string;
  flower_types?: string;
  color?: string;
  style?: string;
  image_url?: string;
  availability?: boolean;
  featured?: boolean;
  premium?: boolean;
  luxury?: boolean;
  budget?: boolean;
  same_day?: boolean;
  categories?: string;
}

export async function getCatalogProducts() {
  const memberId = await requireMemberId();
  const result = await pool.query(
    'SELECT * FROM catalog_products WHERE member_id = $1 ORDER BY featured DESC, created_at DESC',
    [memberId]
  );
  return result.rows;
}

export async function createCatalogProduct(data: CatalogProductData) {
  const memberId = await requireMemberId();
  await pool.query(
    `INSERT INTO catalog_products (
      member_id, name, price, description, occasion, flower_types, color, style, image_url,
      availability, featured, premium, luxury, budget, same_day, categories
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      memberId,
      data.name,
      data.price ?? null,
      data.description || null,
      data.occasion || null,
      data.flower_types || null,
      data.color || null,
      data.style || null,
      data.image_url || null,
      data.availability ?? true,
      data.featured ?? false,
      data.premium ?? false,
      data.luxury ?? false,
      data.budget ?? false,
      data.same_day ?? false,
      data.categories || null,
    ]
  );
  revalidatePath('/admin');
}

export async function updateCatalogProduct(id: string, data: CatalogProductData) {
  const memberId = await requireMemberId();
  await pool.query(
    `UPDATE catalog_products SET
      name = $2, price = $3, description = $4, occasion = $5, flower_types = $6, color = $7,
      style = $8, image_url = $9, availability = $10, featured = $11, premium = $12, luxury = $13,
      budget = $14, same_day = $15, categories = $16, updated_at = NOW()
    WHERE id = $1 AND member_id = $17`,
    [
      id,
      data.name,
      data.price ?? null,
      data.description || null,
      data.occasion || null,
      data.flower_types || null,
      data.color || null,
      data.style || null,
      data.image_url || null,
      data.availability ?? true,
      data.featured ?? false,
      data.premium ?? false,
      data.luxury ?? false,
      data.budget ?? false,
      data.same_day ?? false,
      data.categories || null,
      memberId,
    ]
  );
  revalidatePath('/admin');
}

export async function deleteCatalogProduct(id: string) {
  const memberId = await requireMemberId();
  await pool.query('DELETE FROM catalog_products WHERE id = $1 AND member_id = $2', [id, memberId]);
  revalidatePath('/admin');
}

// AI Settings
export interface AISettingsData {
  temperature?: number;
  model?: string;
  creativity?: 'conservative' | 'balanced' | 'creative';
  greeting?: string;
  language?: 'en' | 'hi' | 'hinglish';
  emoji_level?: 'none' | 'low' | 'medium' | 'high';
  max_reply_length?: number;
  quote_style?: string;
}

export async function getAISettings() {
  const memberId = await requireMemberId();
  const result = await pool.query('SELECT * FROM ai_settings WHERE member_id = $1 LIMIT 1', [memberId]);
  return result.rows[0] || null;
}

export async function saveAISettings(data: AISettingsData) {
  const memberId = await requireMemberId();
  const existing = await pool.query(
    'SELECT id FROM ai_settings WHERE member_id = $1',
    [memberId]
  );

  if (existing.rowCount === 0) {
    await pool.query(
      `INSERT INTO ai_settings (
        member_id, temperature, model, creativity, greeting, language, emoji_level, max_reply_length, quote_style
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        memberId,
        data.temperature ?? 0.7,
        data.model || 'gpt-4o-mini',
        data.creativity || 'balanced',
        data.greeting || null,
        data.language || 'en',
        data.emoji_level || 'low',
        data.max_reply_length ?? 250,
        data.quote_style || 'friendly',
      ]
    );
  } else {
    await pool.query(
      `UPDATE ai_settings SET
        temperature = $2, model = $3, creativity = $4, greeting = $5, language = $6,
        emoji_level = $7, max_reply_length = $8, quote_style = $9, updated_at = NOW()
      WHERE member_id = $1`,
      [
        memberId,
        data.temperature ?? 0.7,
        data.model || 'gpt-4o-mini',
        data.creativity || 'balanced',
        data.greeting || null,
        data.language || 'en',
        data.emoji_level || 'low',
        data.max_reply_length ?? 250,
        data.quote_style || 'friendly',
      ]
    );
  }

  revalidatePath('/admin');
}

// Human Takeover
export async function getHumanTakeover() {
  const memberId = await requireMemberId();
  const result = await pool.query(
    'SELECT active, taken_by, started_at FROM human_takeover WHERE member_id = $1 LIMIT 1',
    [memberId]
  );
  return result.rows[0] || { active: false, taken_by: null, started_at: null };
}

export async function setHumanTakeover(active: boolean) {
  const memberId = await requireMemberId();
  const existing = await pool.query('SELECT id FROM human_takeover WHERE member_id = $1', [memberId]);

  if (existing.rowCount === 0) {
    await pool.query(
      'INSERT INTO human_takeover (member_id, active, taken_by, started_at) VALUES ($1, $2, NULL, NULL)',
      [memberId, active]
    );
  } else {
    await pool.query(
      'UPDATE human_takeover SET active = $2, updated_at = NOW() WHERE member_id = $1',
      [memberId, active]
    );
  }

  revalidatePath('/admin');
}

export async function getDashboardData() {
  const memberId = await requireMemberId();

  const [businessResult, faqResult, catalogResult, aiResult, takeoverResult, conversationResult, phoneResult] =
    await Promise.all([
      pool.query('SELECT business_name FROM business_profiles WHERE member_id = $1 LIMIT 1', [memberId]),
      pool.query('SELECT COUNT(*)::int as count FROM faqs WHERE member_id = $1', [memberId]),
      pool.query('SELECT COUNT(*)::int as count FROM catalog_products WHERE member_id = $1', [memberId]),
      pool.query('SELECT language, creativity, emoji_level FROM ai_settings WHERE member_id = $1 LIMIT 1', [memberId]),
      pool.query('SELECT active FROM human_takeover WHERE member_id = $1 LIMIT 1', [memberId]),
      pool.query(
        'SELECT COUNT(*)::int as count FROM chat_sessions WHERE user_id = $1 AND updated_at > NOW() - INTERVAL \'24 hours\'',
        [memberId]
      ),
      pool.query(
        'SELECT display_phone, status FROM whatsapp_connections WHERE member_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [memberId]
      ),
    ]);

  const business = businessResult.rows[0];
  const takeover = takeoverResult.rows[0];
  const phone = phoneResult.rows[0];

  return {
    business_name: business?.business_name || null,
    faq_count: faqResult.rows[0]?.count || 0,
    catalog_count: catalogResult.rows[0]?.count || 0,
    ai: aiResult.rows[0] || null,
    ai_active: !takeover?.active,
    human_takeover: !!takeover?.active,
    conversations_24h: conversationResult.rows[0]?.count || 0,
    whatsapp_phone: phone?.display_phone || null,
    whatsapp_status: phone?.status || 'not_connected',
  };
}

// Conversations
export async function getConversations() {
  const memberId = await requireMemberId();
  const result = await pool.query(
    `SELECT s.id, s.title, s.created_at, s.updated_at,
            (SELECT content FROM chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM chat_sessions s
     WHERE s.user_id = $1
     ORDER BY s.updated_at DESC
     LIMIT 100`,
    [memberId]
  );
  return result.rows;
}

export async function getMessages(sessionId: string) {
  const memberId = await requireMemberId();
  const result = await pool.query(
    `SELECT m.role, m.content, m.created_at
     FROM chat_messages m
     JOIN chat_sessions s ON s.id = m.session_id
     WHERE s.id = $1 AND s.user_id = $2
     ORDER BY m.created_at ASC`,
    [sessionId, memberId]
  );
  return result.rows;
}

// Catalog source
export async function getCatalogSource() {
  const memberId = await requireMemberId();
  const result = await pool.query(
    'SELECT source, status, connected_at, last_synced_at FROM catalog_sources WHERE member_id = $1 LIMIT 1',
    [memberId]
  );
  return result.rows[0] || { source: 'manual_catalog', status: 'not_connected', connected_at: null, last_synced_at: null };
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
  revalidatePath('/admin');
  revalidatePath('/setup');
}

export async function getDesignGallerySummary() {
  const memberId = await requireMemberId();
  const [countResult, sourceResult] = await Promise.all([
    pool.query('SELECT COUNT(*)::int as count FROM design_gallery WHERE member_id = $1 AND availability = true', [memberId]),
    pool.query('SELECT source, status, last_synced_at FROM catalog_sources WHERE member_id = $1 LIMIT 1', [memberId]),
  ]);
  return {
    count: countResult.rows[0]?.count || 0,
    source: sourceResult.rows[0]?.source || 'manual_catalog',
    status: sourceResult.rows[0]?.status || 'not_connected',
    last_synced_at: sourceResult.rows[0]?.last_synced_at || null,
  };
}

export async function syncDesignGallery() {
  const memberId = await requireMemberId();
  const result = await syncDesignGalleryForMember(memberId);
  revalidatePath('/admin');
  revalidatePath('/setup');
  return result;
}
