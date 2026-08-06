-- Migration: 013_hiring_corrections.sql
-- Supplemental schema corrections & enhancements for Hiring & Document pipeline

-- 1. Document Enhancements for hiring_generated_documents
ALTER TABLE hiring_generated_documents
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS verification_code VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS document_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_document_id UUID REFERENCES hiring_generated_documents(id);

-- Document Sequential Counter Table (atomic OFFER-2026-000001 serial numbers)
CREATE TABLE IF NOT EXISTS hiring_document_counters (
  doc_type VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, year)
);

-- 2. Template Versioning Table
CREATE TABLE IF NOT EXISTS hiring_document_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES hiring_document_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON hiring_document_template_versions(template_id);

-- 3. Unique Partial Index for One Active Template Per Type
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_template_per_type 
  ON hiring_document_templates (type) 
  WHERE is_active = true;

-- 4. Custom Field Responses on hiring_applications
ALTER TABLE hiring_applications
  ADD COLUMN IF NOT EXISTS custom_field_responses JSONB DEFAULT '{}'::jsonb;

-- 5. Additional Performance Indexes
CREATE INDEX IF NOT EXISTS idx_hiring_applications_owner ON hiring_applications(assigned_owner_id);
CREATE INDEX IF NOT EXISTS idx_hiring_applications_offer_status ON hiring_applications(offer_status);

-- 6. Settings Table for Branding & gRPC Configuration
CREATE TABLE IF NOT EXISTS hiring_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_logo_url TEXT,
  letterhead_header_html TEXT,
  signature_image_url TEXT,
  default_sender_email VARCHAR(255) DEFAULT 'careers@codeplusacademy.in',
  default_sender_name VARCHAR(120) DEFAULT 'Code+ Academy Careers',
  grpc_document_service_url VARCHAR(255) DEFAULT 'localhost:50053',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings row if missing
INSERT INTO hiring_settings (id, company_logo_url, default_sender_email, default_sender_name)
VALUES (1, 'https://codeplusacademy.in/cpa-logo-dark.png', 'careers@codeplusacademy.in', 'Code+ Academy Careers')
ON CONFLICT (id) DO NOTHING;
