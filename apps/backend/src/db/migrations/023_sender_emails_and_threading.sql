-- Migration: 023_sender_emails_and_threading
-- Phase A: Verified Sender Email Management (Features 1 & 2)
-- Phase B: Inbound Email Threading & Support Messages (Features 3 & 4)

-- 1. Sender Emails Table
CREATE TABLE IF NOT EXISTS sender_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(120) NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  added_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only ONE default sender exists at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_sender_emails_single_default 
  ON sender_emails (is_default) WHERE is_default = true;

-- Link templates to sender_emails via FK (nullable = use default)
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS sender_email_id UUID REFERENCES sender_emails(id) ON DELETE SET NULL;

-- Seed default known senders
INSERT INTO sender_emails (email, display_name, is_default, is_verified) VALUES
  ('notifications@codeplusacademy.in', 'Code+ Academy', true, true),
  ('careers@codeplusacademy.in', 'Code+ Careers', false, true),
  ('security@codeplusacademy.in', 'Code+ Security', false, true),
  ('safety@codeplusacademy.in', 'Code+ Safety', false, true),
  ('support@codeplusacademy.in', 'Code+ Support', false, true)
ON CONFLICT (email) DO NOTHING;

-- 2. Support Tickets Extensions
ALTER TABLE support_tickets 
  ADD COLUMN IF NOT EXISTS target_mailbox VARCHAR(100) NOT NULL DEFAULT 'support',
  ADD COLUMN IF NOT EXISTS references_message_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS viewing_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS viewing_admin_since TIMESTAMPTZ;

-- GIN index for sub-millisecond thread lookup on Message-ID arrays
CREATE INDEX IF NOT EXISTS idx_tickets_threading_gin 
  ON support_tickets USING gin (references_message_ids);

-- Composite index for thread fallback (reporter_email)
CREATE INDEX IF NOT EXISTS idx_tickets_reporter_mailbox 
  ON support_tickets (reporter_email, target_mailbox, status);

-- 3. Support Email Messages History Table
CREATE TABLE IF NOT EXISTS support_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  resend_email_id VARCHAR(255) UNIQUE NOT NULL,
  internet_message_id VARCHAR(255) UNIQUE NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address VARCHAR(255) NOT NULL,
  to_address TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  sender_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  resend_response_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_ticket 
  ON support_email_messages(ticket_id);
