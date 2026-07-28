-- Migration: 009_create_email_tables
-- Phase A — Creates email_templates, email_schedules, email_preferences, email_campaigns, email_sends

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('transactional','security','promotional')),
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(64) REFERENCES email_templates(key) ON DELETE CASCADE,
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('instant','digest','campaign')),
  frequency_kind VARCHAR(20) NOT NULL CHECK (frequency_kind IN ('event','interval','cron')),
  interval_value INT,
  interval_unit VARCHAR(20) CHECK (interval_unit IN ('minutes','hours','days')),
  cron_expression VARCHAR(64),
  randomize_window_minutes INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES admin_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY,
  transactional_enabled BOOLEAN NOT NULL DEFAULT true,
  promotional_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_frequency VARCHAR(20) NOT NULL DEFAULT 'weekly' CHECK (digest_frequency IN ('off','daily','weekly')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(64) REFERENCES email_templates(key),
  segment_filter JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  template_key VARCHAR(64),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','bounced'))
);

CREATE INDEX IF NOT EXISTS idx_email_sends_user ON email_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
