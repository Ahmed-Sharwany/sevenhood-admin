-- ─────────────────────────────────────────────────────────────────────────────
-- Reminder tracking columns on invoices
-- Run in: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS reminder_count    int         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at  timestamptz;
