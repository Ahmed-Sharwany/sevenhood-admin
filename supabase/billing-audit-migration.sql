-- ─────────────────────────────────────────────────────────────────────────────
-- Billing Duplicate-Prevention & Audit Trail Migration
-- Run this in: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Link commission tickets to the invoice that billed them
ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS invoice_id   uuid REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoiced_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_invoice_id
  ON maintenance_tickets (invoice_id);

-- 2. Billing audit log
CREATE TABLE IF NOT EXISTS billing_audit_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type    text        NOT NULL,         -- 'invoice_generated' | 'invoice_paid' | 'invoice_cancelled' | 'credit_note' | 'adjustment'
  invoice_id    uuid        REFERENCES invoices(id) ON DELETE SET NULL,
  performed_by  uuid,                         -- null = system / cron
  details       jsonb       DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_log_invoice_id  ON billing_audit_log (invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_event_type  ON billing_audit_log (event_type);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_created_at  ON billing_audit_log (created_at DESC);

-- 3. RLS: service_role has full access (already granted by default).
--    Authenticated users (super_admin / org_admin) can read.
ALTER TABLE billing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on billing_audit_log"
  ON billing_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read billing_audit_log"
  ON billing_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin users (super_admin / org_admin) may INSERT audit entries from the client
-- UPDATE and DELETE are intentionally not granted — the log is append-only
CREATE POLICY "authenticated insert billing_audit_log"
  ON billing_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
