-- Migration: 004_create_audit_log
-- Phase 0 — Creates the audit_log table (needed from day one per spec)

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id UUID NOT NULL REFERENCES admin_users(id),
  actor_is_root BOOLEAN NOT NULL,
  permission_used VARCHAR(64),
  module VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(30),
  target_id VARCHAR(64),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log(module);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
