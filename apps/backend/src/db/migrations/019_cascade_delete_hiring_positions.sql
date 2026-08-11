-- Migration 019: Restore standard RESTRICT foreign key constraint on hiring_applications
ALTER TABLE hiring_applications
  DROP CONSTRAINT IF EXISTS hiring_applications_position_id_fkey,
  ADD CONSTRAINT hiring_applications_position_id_fkey
  FOREIGN KEY (position_id) REFERENCES hiring_positions(id);
