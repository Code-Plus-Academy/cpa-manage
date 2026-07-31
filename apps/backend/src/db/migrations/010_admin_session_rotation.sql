-- Migration: 010_admin_session_rotation.sql
-- Add device tracking, rotation, and revocation columns to admin_sessions

ALTER TABLE public.admin_sessions
  ADD COLUMN IF NOT EXISTS device_info TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS replaced_by UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_family_id UUID DEFAULT NULL;

-- Backfill session_family_id for existing active rows
UPDATE public.admin_sessions
  SET session_family_id = id
  WHERE session_family_id IS NULL;

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_admin_sessions_family ON public.admin_sessions(session_family_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON public.admin_sessions(token_hash);
