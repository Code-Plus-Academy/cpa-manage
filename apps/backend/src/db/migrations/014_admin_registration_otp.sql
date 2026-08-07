-- Migration 014: Add worker admin registration OTP verification columns
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS registration_otp TEXT,
  ADD COLUMN IF NOT EXISTS registration_otp_expires_at TIMESTAMPTZ;
