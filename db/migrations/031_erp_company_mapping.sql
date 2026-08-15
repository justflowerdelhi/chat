-- Add ERP company UUID mapping to the AI members table
ALTER TABLE IF EXISTS members
  ADD COLUMN IF NOT EXISTS external_company_id UUID UNIQUE;

-- Add a unique constraint for design_gallery upserts by member + external product id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_design_gallery_member_external'
      AND conrelid = 'design_gallery'::regclass
  ) THEN
    ALTER TABLE design_gallery
      ADD CONSTRAINT unique_design_gallery_member_external
      UNIQUE (member_id, external_id);
  END IF;
END $$;
