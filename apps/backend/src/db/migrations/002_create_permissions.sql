-- Migration: 002_create_permissions
-- Phase 0 — Creates permissions table and seeds the fixed permission keys

CREATE TABLE IF NOT EXISTS permissions (
  key VARCHAR(64) PRIMARY KEY,
  module VARCHAR(32) NOT NULL,
  description TEXT NOT NULL
);

-- Seed the 21 fixed permissions
INSERT INTO permissions (key, module, description) VALUES
  ('support.view',              'support',   'View support tickets'),
  ('support.respond',           'support',   'Respond to and acknowledge support tickets'),
  ('support.close',             'support',   'Close support tickets'),
  ('claims.copyright.view',     'claims',    'View copyright claims'),
  ('claims.copyright.approve',  'claims',    'Approve copyright claims (triggers content removal)'),
  ('claims.copyright.dismiss',  'claims',    'Dismiss copyright claims'),
  ('claims.institution.view',   'claims',    'View institution profile claims'),
  ('claims.institution.approve','claims',    'Approve institution profile claims'),
  ('claims.institution.reject', 'claims',    'Reject institution profile claims'),
  ('claims.reclaim.view',       'claims',    'View content reclaim claims'),
  ('claims.reclaim.approve',    'claims',    'Approve content reclaim (triggers ownership transfer)'),
  ('claims.reclaim.reject',     'claims',    'Reject content reclaim claims'),
  ('users.reports.view',        'users',     'View user moderation reports'),
  ('users.strike',              'users',     'Issue strikes to users'),
  ('users.suspend',             'users',     'Suspend user accounts'),
  ('users.ban',                 'users',     'Ban user accounts (irreversible via UI)'),
  ('content.moderation.view',   'content',   'View content moderation queue'),
  ('content.remove',            'content',   'Remove content via moderation'),
  ('content.restore',           'content',   'Restore previously removed content'),
  ('email.templates.edit',      'email',     'Edit email templates'),
  ('email.schedule.manage',     'email',     'Manage email schedules'),
  ('email.campaign.send',       'email',     'Send email campaigns'),
  ('email.analytics.view',      'email',     'View email analytics'),
  ('audit.view',                'audit',     'View the audit log'),
  ('system.status.view',        'system',    'View system status'),
  ('admin.manage',              'admin',     'Manage admin accounts and permissions (root only)')
ON CONFLICT (key) DO NOTHING;
