-- Migration: 012_hiring_feature_spec.sql
-- Full 10-module Hiring & Career Specification Extensions for cpa-manage

-- 1. Position Management Extensions
ALTER TABLE hiring_positions
  ADD COLUMN IF NOT EXISTS location VARCHAR(60) NOT NULL DEFAULT 'remote',
  ADD COLUMN IF NOT EXISTS requirements TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsibilities TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS salary_range VARCHAR(100),
  ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_response_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_form_fields JSONB DEFAULT '[]'::jsonb;

-- Position Audit Trail
CREATE TABLE IF NOT EXISTS hiring_position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES hiring_positions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES admin_users(id),
  change_type VARCHAR(50) NOT NULL, -- create | update | status_change | duplicate | archive
  changes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_pos_hist_pos ON hiring_position_history(position_id);

-- 2. Application Extensions
ALTER TABLE hiring_applications
  ADD COLUMN IF NOT EXISTS assigned_owner_id UUID REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rejection_notes TEXT,
  ADD COLUMN IF NOT EXISTS offer_status VARCHAR(30) DEFAULT 'none'; -- none | pending | sent | accepted | declined

-- Multi-note support per application
CREATE TABLE IF NOT EXISTS hiring_application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES hiring_applications(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admin_users(id),
  admin_name VARCHAR(120) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_app_notes_app ON hiring_application_notes(application_id);

-- Application Status Audit Trail
CREATE TABLE IF NOT EXISTS hiring_application_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES hiring_applications(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES admin_users(id),
  changed_by_name VARCHAR(120) DEFAULT 'System',
  from_status VARCHAR(30) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_app_hist_app ON hiring_application_history(application_id);

-- 3. Document Templates & Generated Log
CREATE TABLE IF NOT EXISTS hiring_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- offer_letter | certificate | contract
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hiring_generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES hiring_applications(id) ON DELETE CASCADE,
  template_id UUID REFERENCES hiring_document_templates(id),
  document_type VARCHAR(50) NOT NULL,
  rendered_html TEXT NOT NULL,
  pdf_url TEXT,
  variables_used JSONB NOT NULL,
  sent_at TIMESTAMPTZ,
  sent_to VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_gen_docs_app ON hiring_generated_documents(application_id);

-- 4. Notification & Email Log
CREATE TABLE IF NOT EXISTS hiring_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES hiring_applications(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  notification_type VARCHAR(50) NOT NULL, -- status_change | chat_reply | offer_letter | certificate | rejection
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- queued | sent | failed
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_notif_log_app ON hiring_notification_log(application_id);
