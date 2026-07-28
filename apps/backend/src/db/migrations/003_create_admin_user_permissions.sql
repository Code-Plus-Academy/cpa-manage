-- Migration: 003_create_admin_user_permissions
-- Phase 0 — Creates the junction table for admin <-> permission assignments

CREATE TABLE IF NOT EXISTS admin_user_permissions (
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  permission_key VARCHAR(64) NOT NULL REFERENCES permissions(key),
  granted_by UUID NOT NULL REFERENCES admin_users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_aup_admin ON admin_user_permissions(admin_user_id);
