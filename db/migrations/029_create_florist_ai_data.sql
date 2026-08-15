-- Business profile for each florist/member
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL UNIQUE,
  business_name VARCHAR(255),
  tagline VARCHAR(255),
  description TEXT,
  address TEXT,
  google_maps_url TEXT,
  working_hours TEXT,
  delivery_areas TEXT,
  delivery_charges TEXT,
  emergency_delivery BOOLEAN DEFAULT false,
  midnight_delivery BOOLEAN DEFAULT false,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  upi_id VARCHAR(100),
  gst_number VARCHAR(100),
  phone_numbers TEXT,
  email VARCHAR(255),
  cancellation_policy TEXT,
  refund_policy TEXT,
  customization_policy TEXT,
  greeting_message TEXT,
  closing_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_member_id ON business_profiles(member_id);

-- FAQ manager per florist
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_member_id ON faqs(member_id);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(member_id, category);

-- Product catalog per florist
CREATE TABLE IF NOT EXISTS catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(12, 2),
  description TEXT,
  occasion VARCHAR(100),
  flower_types TEXT,
  color VARCHAR(100),
  style VARCHAR(100),
  image_url TEXT,
  availability BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  premium BOOLEAN DEFAULT false,
  luxury BOOLEAN DEFAULT false,
  budget BOOLEAN DEFAULT false,
  same_day BOOLEAN DEFAULT false,
  categories TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_member_id ON catalog_products(member_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_featured ON catalog_products(member_id, featured);

-- Customer conversation memory per florist
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  preferences TEXT,
  favourite_flowers TEXT,
  favourite_colours TEXT,
  occasions TEXT,
  budget VARCHAR(100),
  delivery_address TEXT,
  last_purchase TEXT,
  open_quote TEXT,
  last_ai_summary TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_member_phone ON customer_profiles(member_id, phone);

-- AI settings per florist
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL UNIQUE,
  temperature NUMERIC(3, 2) DEFAULT 0.70,
  model VARCHAR(50) DEFAULT 'gpt-4o-mini',
  creativity VARCHAR(20) DEFAULT 'balanced' CHECK (creativity IN ('conservative', 'balanced', 'creative')),
  greeting TEXT,
  language VARCHAR(20) DEFAULT 'en',
  emoji_level VARCHAR(20) DEFAULT 'low' CHECK (emoji_level IN ('none', 'low', 'medium', 'high')),
  max_reply_length INTEGER DEFAULT 250,
  quote_style VARCHAR(50) DEFAULT 'friendly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_settings_member_id ON ai_settings(member_id);

-- Conversation logging for training
CREATE TABLE IF NOT EXISTS conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  customer_phone VARCHAR(50),
  prompt_text TEXT,
  openai_response TEXT,
  outgoing_reply TEXT,
  model VARCHAR(50),
  latency_ms INTEGER,
  error_message TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_member_id ON conversation_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_created_at ON conversation_logs(created_at DESC);

-- Human takeover state per florist
CREATE TABLE IF NOT EXISTS human_takeover (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL UNIQUE,
  active BOOLEAN DEFAULT false,
  taken_by VARCHAR(255),
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_takeover_member_id ON human_takeover(member_id);
