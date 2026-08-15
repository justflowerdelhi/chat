-- Create whatsapp_connections table for Meta Embedded Signup
CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL,
  business_id TEXT,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL UNIQUE,
  display_phone VARCHAR(50),
  access_token_encrypted TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faster lookup by member (shop)
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_member_id ON whatsapp_connections(member_id);

-- Faster webhook lookup by phone number ID
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_phone_number_id ON whatsapp_connections(phone_number_id);
