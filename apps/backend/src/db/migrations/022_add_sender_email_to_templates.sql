-- Migration: 022_add_sender_email_to_templates
-- Adds sender_email, draft_sender_email, reply_to_email, and draft_reply_to_email to email_templates table

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS draft_sender_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reply_to_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS draft_reply_to_email VARCHAR(255);

-- Seed default sender and reply-to addresses based on template keys
UPDATE email_templates
SET sender_email = 'careers@codeplusacademy.in',
    reply_to_email = 'careers@codeplusacademy.in'
WHERE key LIKE 'hiring_%' AND (sender_email IS NULL OR sender_email = '');

UPDATE email_templates
SET sender_email = 'security@codeplusacademy.in',
    reply_to_email = 'security@codeplusacademy.in'
WHERE (key LIKE 'admin_registration%' OR key LIKE 'password_%' OR key LIKE '%totp%') AND (sender_email IS NULL OR sender_email = '');

UPDATE email_templates
SET sender_email = 'safety@codeplusacademy.in',
    reply_to_email = 'support@codeplusacademy.in'
WHERE (key LIKE '%takedown%' OR key LIKE '%copyright%' OR key LIKE '%strike%') AND (sender_email IS NULL OR sender_email = '');

UPDATE email_templates
SET sender_email = 'notifications@codeplusacademy.in',
    reply_to_email = 'support@codeplusacademy.in'
WHERE sender_email IS NULL OR sender_email = '';
