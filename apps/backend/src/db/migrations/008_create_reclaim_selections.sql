-- Migration: 008_create_reclaim_selections
-- Phase A — Creates reclaim_selections table for per-item creator content reclaim decisions

CREATE TABLE IF NOT EXISTS reclaim_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL,
  content_id UUID NOT NULL,
  decision VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reclaim_selections_ticket ON reclaim_selections(ticket_id);
