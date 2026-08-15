-- Floraprise Design Gallery per florist
-- Source of truth for designs created in the Floraprise app.
CREATE TABLE IF NOT EXISTS design_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL,
  external_id VARCHAR(255),
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
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_gallery_member_id ON design_gallery(member_id);
CREATE INDEX IF NOT EXISTS idx_design_gallery_external_id ON design_gallery(member_id, external_id);
CREATE INDEX IF NOT EXISTS idx_design_gallery_featured ON design_gallery(member_id, featured);

-- Catalog source preference per florist
CREATE TABLE IF NOT EXISTS catalog_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL UNIQUE,
  source VARCHAR(50) NOT NULL DEFAULT 'manual_catalog' CHECK (source IN ('design_gallery', 'manual_catalog')),
  status VARCHAR(50) NOT NULL DEFAULT 'not_connected' CHECK (status IN ('connected', 'not_connected', 'syncing', 'error')),
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_sources_member_id ON catalog_sources(member_id);
