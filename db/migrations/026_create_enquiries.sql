-- Create enquiries table
CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES chat_sessions(id) ON DELETE CASCADE,
  customer_name VARCHAR(255),
  phone VARCHAR(50),
  occasion VARCHAR(255),
  budget VARCHAR(100),
  delivery_date VARCHAR(100),
  delivery_city VARCHAR(255),
  recipient VARCHAR(255),
  recommended_products TEXT,
  special_instructions TEXT,
  summary JSONB,
  lead_quality VARCHAR(20) CHECK (lead_quality IN ('Low', 'Medium', 'High')),
  conversation_confidence INTEGER CHECK (conversation_confidence >= 0 AND conversation_confidence <= 100),
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Contacted', 'Closed'))
);

CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_conversation_id ON enquiries(conversation_id);
