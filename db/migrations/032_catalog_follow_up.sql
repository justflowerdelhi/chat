-- Mark conversations that need design/catalog follow-up when no catalog is available
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS requires_catalog_follow_up BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_type VARCHAR(50) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_requires_catalog_follow_up
  ON chat_sessions(user_id, requires_catalog_follow_up)
  WHERE requires_catalog_follow_up = true;
