-- Migration: 007_create_institution_claims
-- Phase A — Creates institution_claims table with partial unique index per PLAN.md 9.3

CREATE TABLE IF NOT EXISTS institution_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_user_id UUID NOT NULL,
  institution_id UUID NOT NULL,
  claimant_role VARCHAR(120),
  official_email VARCHAR(255),
  proof_documents TEXT[],
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: prevents duplicate pending or approved claims by same user for same institution,
-- while allowing re-submission if a previous claim was rejected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_institution_claims_pending_approved
  ON institution_claims(institution_id, claimant_user_id)
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_institution_claims_user ON institution_claims(claimant_user_id);
CREATE INDEX IF NOT EXISTS idx_institution_claims_inst ON institution_claims(institution_id);
