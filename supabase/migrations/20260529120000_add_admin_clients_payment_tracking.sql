-- ════════════════════════════════════════════════════════════════════
-- Manual payment tracking for admin_clients
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Adds MANUAL payment-tracking fields to the agency client CRM so the
--   founder can record whether a client has paid, how, when they last
--   paid, when the next payment is due, and the PayPal invoice/reference.
--
--   This is manual record-keeping only. It does NOT verify any payment,
--   call the PayPal API, or build checkout. Revenue (MRR/ARR/setup) is
--   still computed from stored fees and remains "Estimated".
--
-- Safety:
--   • Additive only. Re-runnable via ADD COLUMN IF NOT EXISTS guards.
--   • Alters ONLY public.admin_clients. businesses, audit_submissions,
--     admin_leads are untouched.
--   • No column is renamed or dropped. No data is deleted.
--   • Column DEFAULTs give every NEW client sensible payment defaults
--     (unpaid / paypal / due in 30 days) WITHOUT requiring the
--     audit→lead→client conversion code to change — so conversion keeps
--     working regardless of whether this migration is applied.
-- ════════════════════════════════════════════════════════════════════

-- payment_status — required, defaults to 'unpaid'
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CONSTRAINT admin_clients_payment_status_check
    CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid', 'overdue', 'cancelled'));

-- payment_method — optional, defaults to 'paypal' (primary provider)
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'paypal'
    CONSTRAINT admin_clients_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('paypal', 'bank_transfer', 'cash', 'other'));

-- last_payment_date — when the client last paid (manually recorded)
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS last_payment_date date;

-- next_payment_due — defaults to 30 days out for new clients
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS next_payment_due date DEFAULT (CURRENT_DATE + 30);

-- paypal_invoice_id — PayPal invoice / reference ID (manual, free text)
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS paypal_invoice_id text;

-- payment_notes — free-text payment notes
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS payment_notes text;

COMMENT ON COLUMN public.admin_clients.payment_status   IS 'Manual: unpaid | deposit_paid | paid | overdue | cancelled. NOT PayPal-verified.';
COMMENT ON COLUMN public.admin_clients.payment_method   IS 'Manual: paypal | bank_transfer | cash | other.';
COMMENT ON COLUMN public.admin_clients.paypal_invoice_id IS 'Manually-entered PayPal invoice/reference ID. No API verification.';

-- Indexes — payment status filtering + due-date scans
CREATE INDEX IF NOT EXISTS admin_clients_payment_status_idx   ON public.admin_clients (payment_status);
CREATE INDEX IF NOT EXISTS admin_clients_next_payment_due_idx ON public.admin_clients (next_payment_due);
