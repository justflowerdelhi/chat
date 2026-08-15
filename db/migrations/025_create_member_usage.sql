-- Create member_usage table for tracking API usage limits
CREATE TABLE IF NOT EXISTS member_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  questions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_member_usage_user_month ON member_usage(user_id, month);
