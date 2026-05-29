-- ════════════════════════════════════════════════════════════════════
-- Admin sales pipeline: admin_leads + admin_clients
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   These two tables are the Helios AGENCY's internal CRM — the sales
--   pipeline and converted-client records the founder manages from
--   /admin/leads and /admin/clients.
--
--   They are DISTINCT from the existing per-business tables:
--     • public.leads      = an individual client's END-CUSTOMER leads
--                           (scoped by business_id; used in /dashboard).
--     • public.businesses = a client's product account / workspace.
--   Reusing those would corrupt client-facing data, so the agency CRM
--   gets its own dedicated tables.
--
-- Flow:
--   audit_submissions (intake)
--     → qualify   → admin_leads   (sales pipeline)
--     → convert   → admin_clients (signed/onboarding client)
--   audit_submissions.status is moved to 'qualified' / 'converted' as
--   the founder advances a submission. The UNIQUE constraints on
--   source_audit_id / source_lead_id make it impossible to create two
--   leads or two clients from the same audit.
--
-- Safety:
--   • Additive only. Re-runnable via IF NOT EXISTS / DROP POLICY guards.
--   • NO existing table is altered. businesses / leads / audit_submissions
--     are untouched.
--   • No hard deletes anywhere in the app — archiving sets
--     status/stage = 'archived' and stamps archived_at.
--   • RLS mirrors audit_submissions: founder_admin only via
--     is_founder_admin() (migration 20260518120000); the service role
--     (server actions) bypasses RLS. Anon and non-founders get nothing.
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Shared updated_at trigger fn (self-contained, idempotent) ───────
CREATE OR REPLACE FUNCTION public.admin_pipeline_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 1. admin_leads — agency sales pipeline
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origin: the audit submission this lead was qualified from (nullable
  -- so leads can also be created manually). UNIQUE → no duplicate lead
  -- from the same audit.
  source_audit_id  uuid UNIQUE REFERENCES public.audit_submissions ON DELETE SET NULL,

  -- Identity
  business_name    text NOT NULL,
  contact_name     text,
  email            text,
  phone            text,
  website          text,
  industry         text,
  location         text,

  -- Pipeline
  target_plan      text,                              -- 'starter' | 'pro' | 'scale' (nullable)
  stage            text NOT NULL DEFAULT 'new',
  estimated_value  integer NOT NULL DEFAULT 0,        -- whole USD
  next_action      text,
  notes            text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  archived_at      timestamptz,

  CONSTRAINT admin_leads_stage_check CHECK (stage IN (
    'new', 'qualified', 'audit_sent', 'proposal', 'won', 'lost', 'archived'
  )),
  CONSTRAINT admin_leads_target_plan_check CHECK (
    target_plan IS NULL OR target_plan IN ('starter', 'pro', 'scale')
  ),
  CONSTRAINT admin_leads_estimated_value_check CHECK (estimated_value >= 0)
);

COMMENT ON TABLE public.admin_leads IS 'Helios agency sales pipeline. Founder-managed via /admin/leads. Distinct from public.leads (per-business end-customer leads).';

CREATE INDEX IF NOT EXISTS admin_leads_stage_idx      ON public.admin_leads (stage, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_leads_created_at_idx ON public.admin_leads (created_at DESC);

DROP TRIGGER IF EXISTS admin_leads_set_updated_at ON public.admin_leads;
CREATE TRIGGER admin_leads_set_updated_at
  BEFORE UPDATE ON public.admin_leads
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- 2. admin_clients — converted client accounts (agency CRM)
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_clients (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origin links (both nullable, both UNIQUE → no duplicate client from
  -- the same audit or the same lead).
  source_audit_id      uuid UNIQUE REFERENCES public.audit_submissions ON DELETE SET NULL,
  source_lead_id       uuid UNIQUE REFERENCES public.admin_leads        ON DELETE SET NULL,

  -- Identity
  business_name        text NOT NULL,
  contact_name         text,
  email                text,
  phone                text,
  website              text,
  industry             text,
  city                 text,

  -- Commercial
  plan                 text,                          -- 'starter' | 'pro' | 'scale'
  setup_fee            integer NOT NULL DEFAULT 0,    -- whole USD (one-time)
  monthly_fee          integer NOT NULL DEFAULT 0,    -- whole USD (recurring) → drives MRR/ARR
  status               text NOT NULL DEFAULT 'onboarding',

  -- Lightweight activity snapshot (editable; not a live aggregate)
  leads_this_month     integer NOT NULL DEFAULT 0,
  bookings_this_month  integer NOT NULL DEFAULT 0,

  client_since         date,
  notes                text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  archived_at          timestamptz,

  CONSTRAINT admin_clients_status_check CHECK (status IN (
    'active', 'onboarding', 'paused', 'churned', 'archived'
  )),
  CONSTRAINT admin_clients_plan_check CHECK (
    plan IS NULL OR plan IN ('starter', 'pro', 'scale')
  ),
  CONSTRAINT admin_clients_setup_fee_check   CHECK (setup_fee   >= 0),
  CONSTRAINT admin_clients_monthly_fee_check CHECK (monthly_fee >= 0),
  CONSTRAINT admin_clients_leads_check       CHECK (leads_this_month    >= 0),
  CONSTRAINT admin_clients_bookings_check    CHECK (bookings_this_month >= 0)
);

COMMENT ON TABLE public.admin_clients IS 'Helios agency client CRM (commercial layer). Founder-managed via /admin/clients. Distinct from public.businesses (client product accounts).';

CREATE INDEX IF NOT EXISTS admin_clients_status_idx     ON public.admin_clients (status, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_clients_created_at_idx ON public.admin_clients (created_at DESC);

DROP TRIGGER IF EXISTS admin_clients_set_updated_at ON public.admin_clients;
CREATE TRIGGER admin_clients_set_updated_at
  BEFORE UPDATE ON public.admin_clients
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- 3. Row Level Security — founder_admin only (mirrors audit_submissions)
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.admin_leads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_leads   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.admin_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_clients FORCE  ROW LEVEL SECURITY;

-- admin_leads policies
DROP POLICY IF EXISTS admin_leads_select_founder_admin ON public.admin_leads;
DROP POLICY IF EXISTS admin_leads_insert_founder_admin ON public.admin_leads;
DROP POLICY IF EXISTS admin_leads_update_founder_admin ON public.admin_leads;
DROP POLICY IF EXISTS admin_leads_delete_founder_admin ON public.admin_leads;

CREATE POLICY admin_leads_select_founder_admin ON public.admin_leads
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY admin_leads_insert_founder_admin ON public.admin_leads
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY admin_leads_update_founder_admin ON public.admin_leads
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY admin_leads_delete_founder_admin ON public.admin_leads
  FOR DELETE TO authenticated USING (public.is_founder_admin());

-- admin_clients policies
DROP POLICY IF EXISTS admin_clients_select_founder_admin ON public.admin_clients;
DROP POLICY IF EXISTS admin_clients_insert_founder_admin ON public.admin_clients;
DROP POLICY IF EXISTS admin_clients_update_founder_admin ON public.admin_clients;
DROP POLICY IF EXISTS admin_clients_delete_founder_admin ON public.admin_clients;

CREATE POLICY admin_clients_select_founder_admin ON public.admin_clients
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY admin_clients_insert_founder_admin ON public.admin_clients
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY admin_clients_update_founder_admin ON public.admin_clients
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY admin_clients_delete_founder_admin ON public.admin_clients
  FOR DELETE TO authenticated USING (public.is_founder_admin());

-- ── Access matrix ───────────────────────────────────────────────────
--   anon                         → 0 read / 0 write
--   authenticated, not founder   → 0 read / 0 write
--   authenticated, founder_admin → full SELECT/INSERT/UPDATE/DELETE
--   service_role                 → bypasses RLS (used by server actions)
