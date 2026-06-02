-- ─────────────────────────────────────────────────────────────────────────────
-- Add per-account custom billing rate
-- Run in: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS unit_monthly_fee numeric(10,2) DEFAULT NULL;
