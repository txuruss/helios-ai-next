-- ════════════════════════════════════════════════════════════════════
-- Client CRM detail: notes, manual payment history, onboarding stage
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Backs the client detail drawer on /admin/clients with persistent
--   notes, a manual payment-event history, and an onboarding stage.
--
--   All payment data is MANUAL record-keeping. Nothing here calls the
--   PayPal API, builds checkout, or verifies a payment. Revenue stays
--   "Estimated".
--
-- Safety:
--   • Additive only. Re-runnable (ADD COLUMN/TABLE IF NOT EXISTS,
--     DROP POLICY IF EXISTS).
--   • Alters ONLY admin_clients (adds columns) + creates two new tables.
--     businesses / audit_submissions / admin_leads are untouched.
--   • No column renamed/dropped. No hard deletes (events/notes are
--     append-only; clients use status='archived').
--   • RLS mirrors admin_clients: founder_admin only via is_founder_admin();
--     server actions use the service-role client.
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. admin_clients onboarding fields (additive) ──────────────────
ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS onboarding_stage text NOT NULL DEFAULT 'not_started'
    CONSTRAINT admin_clients_onboarding_stage_check
    CHECK (onboarding_stage IN (
      'not_started', 'intake_needed', 'setup_in_progress', 'testing', 'live', 'complete'
    ));

ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS onboarding_notes text;

ALTER TABLE public.admin_clients
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ── 2. admin_client_payment_events — manual payment history ────────
CREATE TABLE IF NOT EXISTS public.admin_client_payment_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES public.admin_clients(id) ON DELETE CASCADE,
  payment_status    text NOT NULL,
  payment_method    text,
  amount            numeric,
  payment_date      date,
  next_payment_due  date,
  paypal_invoice_id text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_client_payment_events_status_check CHECK (payment_status IN (
    'unpaid', 'deposit_paid', 'paid', 'overdue', 'cancelled'
  )),
  CONSTRAINT admin_client_payment_events_method_check CHECK (
    payment_method IS NULL OR payment_method IN ('paypal', 'bank_transfer', 'cash', 'other')
  ),
  CONSTRAINT admin_client_payment_events_amount_check CHECK (amount IS NULL OR amount >= 0)
);

COMMENT ON TABLE public.admin_client_payment_events IS 'Manual payment history per client. Append-only. NOT PayPal-verified — no API calls.';

CREATE INDEX IF NOT EXISTS admin_client_payment_events_client_idx
  ON public.admin_client_payment_events (client_id, created_at DESC);

-- ── 3. admin_client_notes — client notes ───────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_client_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.admin_clients(id) ON DELETE CASCADE,
  note        text NOT NULL,
  note_type   text NOT NULL DEFAULT 'general',
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_client_notes_type_check CHECK (note_type IN (
    'general', 'payment', 'onboarding', 'support', 'retention'
  ))
);

COMMENT ON TABLE public.admin_client_notes IS 'Founder notes per client. Newest first. No hard delete (archive pattern only if added later).';

CREATE INDEX IF NOT EXISTS admin_client_notes_client_idx
  ON public.admin_client_notes (client_id, created_at DESC);

-- ── 4. Row Level Security — founder_admin only ─────────────────────
ALTER TABLE public.admin_client_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_client_payment_events FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.admin_client_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_client_notes          FORCE  ROW LEVEL SECURITY;

-- payment events
DROP POLICY IF EXISTS acpe_select_founder_admin ON public.admin_client_payment_events;
DROP POLICY IF EXISTS acpe_insert_founder_admin ON public.admin_client_payment_events;
DROP POLICY IF EXISTS acpe_update_founder_admin ON public.admin_client_payment_events;
DROP POLICY IF EXISTS acpe_delete_founder_admin ON public.admin_client_payment_events;

CREATE POLICY acpe_select_founder_admin ON public.admin_client_payment_events
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY acpe_insert_founder_admin ON public.admin_client_payment_events
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY acpe_update_founder_admin ON public.admin_client_payment_events
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY acpe_delete_founder_admin ON public.admin_client_payment_events
  FOR DELETE TO authenticated USING (public.is_founder_admin());

-- notes
DROP POLICY IF EXISTS acn_select_founder_admin ON public.admin_client_notes;
DROP POLICY IF EXISTS acn_insert_founder_admin ON public.admin_client_notes;
DROP POLICY IF EXISTS acn_update_founder_admin ON public.admin_client_notes;
DROP POLICY IF EXISTS acn_delete_founder_admin ON public.admin_client_notes;

CREATE POLICY acn_select_founder_admin ON public.admin_client_notes
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY acn_insert_founder_admin ON public.admin_client_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY acn_update_founder_admin ON public.admin_client_notes
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY acn_delete_founder_admin ON public.admin_client_notes
  FOR DELETE TO authenticated USING (public.is_founder_admin());
