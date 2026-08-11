-- Migration 019: Add CASCADE delete to hiring_applications.position_id foreign key constraint
ALTER TABLE hiring_applications
  DROP CONSTRAINT IF EXISTS hiring_applications_position_id_fkey,
  ADD CONSTRAINT hiring_applications_position_id_fkey
  FOREIGN KEY (position_id) REFERENCES hiring_positions(id) ON DELETE CASCADE;
