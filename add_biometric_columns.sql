-- ============================================================
-- MIGRATION: Add biometric columns to members table
-- Run this in Supabase SQL Editor if your members table
-- is missing zk_id and/or fingerprint_template columns.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- 1. Add zk_id column (the numeric ID assigned in the scanner app)
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS zk_id VARCHAR(50);

-- 2. Add fingerprint_template column (raw fingerprint template data)
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS fingerprint_template TEXT;

-- 3. Add index for fast scanner lookups on both columns
CREATE INDEX IF NOT EXISTS idx_members_zk_id
  ON members (zk_id)
  WHERE zk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_fingerprint
  ON members (fingerprint_template)
  WHERE fingerprint_template IS NOT NULL;

-- ============================================================
-- Verify: run this to confirm the columns now exist
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'members'
  AND column_name IN ('zk_id', 'fingerprint_template')
ORDER BY column_name;
