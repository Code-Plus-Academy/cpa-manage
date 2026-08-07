-- Migration 015: Allow 'pending_verification' status in admin_users constraint
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_status_check;

ALTER TABLE admin_users ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('active', 'disabled', 'pending_verification'));
