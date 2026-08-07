-- Migration 018: Seed admin_registration_otp customizable email template into email_templates
INSERT INTO email_templates (key, name, category, subject_template, body_html_template, is_active)
VALUES (
  'admin_registration_otp',
  'Worker Admin Registration OTP',
  'security',
  '[Code+ Academy] Complete Your Worker Admin Registration - Verification OTP: {{otp_code}}',
  '<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;"><h2 style="color: #6366f1;">Worker Admin Account Registration</h2><p>Hello {{display_name}},</p><p>You have been invited to join the Code+ Academy Administration console as a Worker Admin.</p><p>Your 6-digit One-Time Registration Passcode (OTP) is:</p><div style="background: #1e1b4b; color: #818cf8; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 14px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">{{otp_code}}</div><p style="font-size: 12px; color: #6b7280;">This OTP will expire in {{expires_minutes}} minutes.</p><p>Best regards,<br/>Code+ Academy Administration</p></div>',
  true
)
ON CONFLICT (key) DO NOTHING;
