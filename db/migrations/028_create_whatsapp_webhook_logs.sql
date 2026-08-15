-- Create whatsapp_webhook_logs table for webhook diagnostics
CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER,
  phone_number_id TEXT NOT NULL,
  customer_phone VARCHAR(50),
  incoming_text TEXT,
  ai_reply TEXT,
  meta_status INTEGER,
  error_message TEXT,
  latency_ms INTEGER,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_member_id ON whatsapp_webhook_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_logs_received_at ON whatsapp_webhook_logs(received_at DESC);
