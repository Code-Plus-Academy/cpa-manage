-- Migration: 006_create_moderation_tables
-- Phase A — Creates strikes and suspensions tables

CREATE TABLE IF NOT EXISTS strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  issued_by UUID NOT NULL REFERENCES admin_users(id),
  reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strikes_user ON strikes(user_id);
CREATE INDEX IF NOT EXISTS idx_strikes_active ON strikes(user_id, is_active);

CREATE TABLE IF NOT EXISTS suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  suspended_by UUID NOT NULL REFERENCES admin_users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'suspended'
    CHECK (status IN ('suspended','lifted','expired','banned')),
  suspended_until TIMESTAMPTZ,                -- null for indefinite/banned
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suspensions_user ON suspensions(user_id);
