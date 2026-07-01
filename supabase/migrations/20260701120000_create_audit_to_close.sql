-- ════════════════════════════════════════════════════════════════════
-- Audit-to-Close Engine (Phase 1): atc_leads + atc_audits +
-- atc_pain_points + atc_agent_runs
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Internal agency tool that turns a local service business into a
--   qualified lead with an audit, structured pain points, a package
--   recommendation, a custom offer, and DRAFT outreach messages.
--   Nothing here auto-sends anything — drafts require human approval.
--
-- Distinct from:
--   • public.leads / agent_runs        — client PRODUCT data (per-business,
--     used by /dashboard). atc_agent_runs is separate on purpose.
--   • admin_outreach_leads             — the manual outreach CRM.
--   • admin_leads / admin_clients      — the agency sales pipeline.
--     "Convert to client" inserts an admin_leads row (stage=qualified)
--     so the existing pipeline handles the rest.
--
-- Safety:
--   • Additive only. Re-runnable (IF NOT EXISTS / DROP POLICY IF EXISTS).
--   • No existing table is altered.
--   • Soft archive only (status='archived' + archived_at) for leads.
--     atc_pain_points rows are regenerable AI artifacts and are replaced
--     on regeneration — that is the one intentional delete.
--   • RLS: founder_admin via is_founder_admin(); per-agent isolation is
--     enforced in app code (lib/data/atc-leads.ts) via the service-role
--     client, matching research_leads / admin_outreach_leads.
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger fn (re-declared so this file is self-sufficient).
CREATE OR REPLACE FUNCTION public.admin_pipeline_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 1. atc_leads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atc_leads (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity / research fields
  business_name               text NOT NULL,
  industry                    text,
  location                    text,
  website_url                 text,
  google_maps_url             text,
  phone                       text,
  email                       text,
  instagram_url               text,
  facebook_url                text,
  whatsapp_number             text,
  opening_hours               text,
  rating                      numeric(3,2),
  review_count                integer,
  services                    text,
  notes                       text,
  source                      text NOT NULL DEFAULT 'manual',

  -- Pipeline
  status                      text NOT NULL DEFAULT 'new',

  -- Ownership (app-code scoping: founder sees all; agents see only leads
  -- they created OR are assigned to). Snapshots keep names stable.
  created_by_team_member_id   uuid REFERENCES public.team_members ON DELETE SET NULL,
  created_by_name             text,
  created_by_email            text,
  assigned_to_team_member_id  uuid REFERENCES public.team_members ON DELETE SET NULL,
  assigned_to_name            text,

  -- Qualification result (written by qualifyLead — deterministic rules)
  fit_score                   integer,
  fit_level                   text,
  recommended_package         text,
  close_difficulty            text,
  qualification_json          jsonb,
  qualified_at                timestamptz,

  -- Offer + outreach drafts (written by the generators)
  offer_json                  jsonb,
  offer_generated_at          timestamptz,
  outreach_json               jsonb,
  outreach_generated_at       timestamptz,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  archived_at                 timestamptz,

  CONSTRAINT atc_leads_status_check CHECK (status IN (
    'new', 'researching', 'audited', 'qualified', 'ready_for_outreach',
    'contacted', 'follow_up_needed', 'discovery_booked', 'proposal_sent',
    'closed', 'lost', 'archived'
  )),
  CONSTRAINT atc_leads_fit_score_check CHECK (fit_score IS NULL OR (fit_score >= 0 AND fit_score <= 100)),
  CONSTRAINT atc_leads_fit_level_check CHECK (fit_level IS NULL OR fit_level IN ('poor', 'possible', 'good', 'strong')),
  CONSTRAINT atc_leads_package_check CHECK (recommended_package IS NULL OR recommended_package IN ('starter', 'pro', 'scale')),
  CONSTRAINT atc_leads_difficulty_check CHECK (close_difficulty IS NULL OR close_difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT atc_leads_rating_check CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CONSTRAINT atc_leads_review_count_check CHECK (review_count IS NULL OR review_count >= 0)
);

COMMENT ON TABLE public.atc_leads IS 'Audit-to-Close engine leads (agency prospecting). Per-agent scoping enforced in app code via lib/data/atc-leads.ts.';

CREATE INDEX IF NOT EXISTS atc_leads_status_idx      ON public.atc_leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS atc_leads_created_by_idx  ON public.atc_leads (created_by_team_member_id);
CREATE INDEX IF NOT EXISTS atc_leads_assigned_to_idx ON public.atc_leads (assigned_to_team_member_id);
CREATE INDEX IF NOT EXISTS atc_leads_archived_idx    ON public.atc_leads (archived_at);

DROP TRIGGER IF EXISTS atc_leads_set_updated_at ON public.atc_leads;
CREATE TRIGGER atc_leads_set_updated_at
  BEFORE UPDATE ON public.atc_leads
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── 2. atc_audits (one current audit per lead — upserted) ──────────
CREATE TABLE IF NOT EXISTS public.atc_audits (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                   uuid NOT NULL UNIQUE REFERENCES public.atc_leads ON DELETE CASCADE,

  overall_score             integer,          -- 0–100, derived from categories
  mobile_score              integer,          -- 0–10 each
  booking_score             integer,
  cta_score                 integer,
  trust_score               integer,
  lead_capture_score        integer,
  whatsapp_score            integer,
  automation_score          integer,

  audit_summary             text,
  -- All 10 categories: { <key>: { score, issue, why_it_matters,
  --   suggested_fix, helios_opportunity } }
  audit_json                jsonb NOT NULL DEFAULT '{}',

  created_by_team_member_id uuid REFERENCES public.team_members ON DELETE SET NULL,
  created_by_name           text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT atc_audits_overall_check CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  CONSTRAINT atc_audits_mobile_check       CHECK (mobile_score       IS NULL OR (mobile_score       >= 0 AND mobile_score       <= 10)),
  CONSTRAINT atc_audits_booking_check      CHECK (booking_score      IS NULL OR (booking_score      >= 0 AND booking_score      <= 10)),
  CONSTRAINT atc_audits_cta_check          CHECK (cta_score          IS NULL OR (cta_score          >= 0 AND cta_score          <= 10)),
  CONSTRAINT atc_audits_trust_check        CHECK (trust_score        IS NULL OR (trust_score        >= 0 AND trust_score        <= 10)),
  CONSTRAINT atc_audits_lead_capture_check CHECK (lead_capture_score IS NULL OR (lead_capture_score >= 0 AND lead_capture_score <= 10)),
  CONSTRAINT atc_audits_whatsapp_check     CHECK (whatsapp_score     IS NULL OR (whatsapp_score     >= 0 AND whatsapp_score     <= 10)),
  CONSTRAINT atc_audits_automation_check   CHECK (automation_score   IS NULL OR (automation_score   >= 0 AND automation_score   <= 10))
);

COMMENT ON TABLE public.atc_audits IS 'Manual booking-readiness audit per Audit-to-Close lead (one current audit per lead, upserted).';

DROP TRIGGER IF EXISTS atc_audits_set_updated_at ON public.atc_audits;
CREATE TRIGGER atc_audits_set_updated_at
  BEFORE UPDATE ON public.atc_audits
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── 3. atc_pain_points (regenerable AI artifacts) ──────────────────
CREATE TABLE IF NOT EXISTS public.atc_pain_points (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              uuid NOT NULL REFERENCES public.atc_leads ON DELETE CASCADE,
  audit_id             uuid REFERENCES public.atc_audits ON DELETE SET NULL,

  category             text NOT NULL,
  severity             text NOT NULL DEFAULT 'medium',
  evidence             text,
  business_impact      text,
  recommended_solution text,
  sales_angle          text,

  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT atc_pain_points_category_check CHECK (category IN (
    'missed_lead_risk', 'booking_friction', 'slow_response_risk',
    'weak_trust_signals', 'poor_mobile_experience', 'poor_conversion',
    'no_automation', 'weak_follow_up', 'manual_owner_workload'
  )),
  CONSTRAINT atc_pain_points_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

COMMENT ON TABLE public.atc_pain_points IS 'Structured pain points generated from a lead + its audit. Replaced wholesale on regeneration (derived artifacts).';

CREATE INDEX IF NOT EXISTS atc_pain_points_lead_idx ON public.atc_pain_points (lead_id, created_at DESC);

-- ── 4. atc_agent_runs (generation log — separate from the client
--      product's agent_runs table on purpose) ───────────────────────
CREATE TABLE IF NOT EXISTS public.atc_agent_runs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                   uuid REFERENCES public.atc_leads ON DELETE CASCADE,
  agent_name                text NOT NULL,
  status                    text NOT NULL DEFAULT 'running',
  input_json                jsonb,
  output_json               jsonb,
  error_message             text,
  created_by_team_member_id uuid REFERENCES public.team_members ON DELETE SET NULL,
  created_by_name           text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  completed_at              timestamptz,

  CONSTRAINT atc_agent_runs_agent_check CHECK (agent_name IN (
    'pain_points', 'qualification', 'offer', 'outreach', 'orchestrator'
  )),
  CONSTRAINT atc_agent_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

COMMENT ON TABLE public.atc_agent_runs IS 'Audit-to-Close generation run log (agency-internal). NOT the client product agent_runs table.';

CREATE INDEX IF NOT EXISTS atc_agent_runs_lead_idx ON public.atc_agent_runs (lead_id, created_at DESC);

-- ── Row Level Security — founder_admin only (service role bypasses;
--    per-agent scoping happens in app code) ──────────────────────────
ALTER TABLE public.atc_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atc_leads       FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.atc_audits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atc_audits      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.atc_pain_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atc_pain_points FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.atc_agent_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atc_agent_runs  FORCE  ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['atc_leads', 'atc_audits', 'atc_pain_points', 'atc_agent_runs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_founder ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_founder ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_founder ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_founder ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select_founder ON public.%I FOR SELECT TO authenticated USING (public.is_founder_admin())', t, t);
    EXECUTE format('CREATE POLICY %I_insert_founder ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin())', t, t);
    EXECUTE format('CREATE POLICY %I_update_founder ON public.%I FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin())', t, t);
    EXECUTE format('CREATE POLICY %I_delete_founder ON public.%I FOR DELETE TO authenticated USING (public.is_founder_admin())', t, t);
  END LOOP;
END;
$$;
