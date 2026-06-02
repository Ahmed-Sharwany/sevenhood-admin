-- ── Billing Migration ────────────────────────────────────────────────────────
-- Sevenhood Platform — Saudi Arabia PropTech
-- Run this in the Supabase SQL editor

-- Add actual_cost to maintenance_tickets
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS actual_cost numeric(10,2) DEFAULT NULL;

-- Platform billing settings (single row table)
CREATE TABLE IF NOT EXISTS platform_settings (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_monthly_fee      numeric(10,2) NOT NULL DEFAULT 50.00,
  service_commission_pct numeric(5,2) NOT NULL DEFAULT 10.00,
  vat_pct               numeric(5,2)  NOT NULL DEFAULT 15.00,
  currency              varchar(3)    NOT NULL DEFAULT 'SAR',
  invoice_due_days      integer       NOT NULL DEFAULT 7,
  updated_at            timestamptz   DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id                  uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number      text    UNIQUE NOT NULL,
  account_id          uuid    REFERENCES accounts(id) ON DELETE SET NULL,
  service_provider_id uuid    REFERENCES service_providers(id) ON DELETE SET NULL,
  invoice_type        text    NOT NULL CHECK (invoice_type IN ('subscription', 'commission')),
  period_start        date    NOT NULL,
  period_end          date    NOT NULL,
  subtotal            numeric(10,2) NOT NULL DEFAULT 0,
  vat_amount          numeric(10,2) NOT NULL DEFAULT 0,
  total               numeric(10,2) NOT NULL DEFAULT 0,
  status              text    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date            date,
  paid_at             timestamptz,
  payment_gateway_id  text,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_items (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id     uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description    text NOT NULL,
  quantity       integer      NOT NULL DEFAULT 1,
  unit_price     numeric(10,2) NOT NULL,
  amount         numeric(10,2) NOT NULL,
  reference_id   uuid,
  reference_type text  -- 'unit' or 'ticket'
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id     uuid    REFERENCES invoices(id) ON DELETE SET NULL,
  amount         numeric(10,2) NOT NULL,
  currency       varchar(3)    NOT NULL DEFAULT 'SAR',
  gateway        text          NOT NULL DEFAULT 'moyasar',
  gateway_id     text,
  gateway_status text,
  status         text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'paid', 'failed', 'refunded')),
  payment_method text,
  paid_at        timestamptz,
  metadata       jsonb,
  created_at     timestamptz DEFAULT now()
);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by all API routes)
CREATE POLICY "service_role_platform_settings" ON platform_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_invoices"           ON invoices           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_invoice_items"      ON invoice_items      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_payments"           ON payments           FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read invoices and payments (for their own dashboard)
CREATE POLICY "authenticated_read_invoices" ON invoices  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_payments" ON payments  FOR SELECT TO authenticated USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS invoices_account_id_idx          ON invoices(account_id);
CREATE INDEX IF NOT EXISTS invoices_service_provider_id_idx ON invoices(service_provider_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx              ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_period_start_idx        ON invoices(period_start);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx          ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx     ON invoice_items(invoice_id);
