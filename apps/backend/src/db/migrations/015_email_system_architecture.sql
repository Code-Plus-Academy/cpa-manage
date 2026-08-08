-- Migration 015: Email System Architecture Enhancements
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS draft_subject_template TEXT,
  ADD COLUMN IF NOT EXISTS draft_body_html_template TEXT,
  ADD COLUMN IF NOT EXISTS available_placeholders JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Drop old check constraint to support all expanded categories
ALTER TABLE email_templates
  DROP CONSTRAINT IF EXISTS email_templates_category_check;

ALTER TABLE email_templates
  ADD CONSTRAINT email_templates_category_check 
  CHECK (category IN ('transactional', 'security', 'promotional', 'hiring', 'support', 'social'));

-- Template Version Control History Snapshot Table
CREATE TABLE IF NOT EXISTS email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100) REFERENCES email_templates(key) ON DELETE CASCADE,
  version INT NOT NULL,
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  published_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_key, version)
);
