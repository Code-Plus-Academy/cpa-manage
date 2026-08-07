-- Migration 017: Add recipient_email, subject, body_html columns to email_sends table
ALTER TABLE email_sends
  ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS body_html TEXT;
