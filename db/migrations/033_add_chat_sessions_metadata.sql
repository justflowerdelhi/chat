-- Add a JSONB metadata column to chat_sessions for temporary locator state
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Optional GIN index for fast metadata lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_metadata ON chat_sessions USING GIN(metadata);
