-- Migration 014: Add worker admin registration OTP verification columns
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS registration_otp TEXT,
  ADD COLUMN IF NOT EXISTS registration_otp_expires_at TIMESTAMPTZ;

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_status_check;

ALTER TABLE admin_users ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('active', 'disabled', 'pending_verification'));
