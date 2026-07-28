-- Migration: 005_create_support_tickets
-- Phase A — Creates support_tickets, ticket_actions, and appeals tables

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                                 -- null if unauthenticated reporter
  reporter_email VARCHAR(255),                 -- required if user_id is null
  type VARCHAR(32) NOT NULL,
  case_source VARCHAR(30) NOT NULL DEFAULT 'private_complainant',
  category VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  content_type VARCHAR(20),
  content_id UUID,
  source_surface VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  sla_resolve_by TIMESTAMPTZ NOT NULL,
  assigned_admin_id UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(type);

CREATE TABLE IF NOT EXISTS ticket_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admin_users(id),
  action_type VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  issued_strike BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_actions_ticket ON ticket_actions(ticket_id);

CREATE TABLE IF NOT EXISTS appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure ticket_id column exists if appeals was created in an earlier legacy migration
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appeals' AND column_name='ticket_id') THEN
    ALTER TABLE appeals ADD COLUMN ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enforce UNIQUE(ticket_id, user_id) constraint on appeals
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_appeals_ticket_user') THEN
    ALTER TABLE appeals ADD CONSTRAINT uq_appeals_ticket_user UNIQUE(ticket_id, user_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_appeals_ticket ON appeals(ticket_id);
