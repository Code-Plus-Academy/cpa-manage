-- Migration 021: Schema fixes for hiring tables and missing columns
-- 1. Document counter sequence table for hiring serial numbers
CREATE TABLE IF NOT EXISTS hiring_document_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_type, year)
);

-- 2. Document template version history table
CREATE TABLE IF NOT EXISTS hiring_document_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES hiring_document_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  html_content TEXT NOT NULL,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Hiring branding settings table
CREATE TABLE IF NOT EXISTS hiring_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Application table column additions
ALTER TABLE hiring_applications
  ADD COLUMN IF NOT EXISTS cover_letter TEXT,
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;

-- 5. Generated documents column additions
ALTER TABLE hiring_generated_documents
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS verification_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS document_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_document_id UUID REFERENCES hiring_generated_documents(id);

-- 6. Application history column additions
ALTER TABLE hiring_application_history
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS notes TEXT;
