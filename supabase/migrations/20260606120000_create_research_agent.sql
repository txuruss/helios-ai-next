-- ════════════════════════════════════════════════════════════════════
-- Business Research Agent: research_runs + research_leads
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Founder-driven local-business research. Each "run" records a search
--   task (location + niches) executed against the Google Places API.
--   Qualified businesses are scored with rule-based logic and can be
--   saved as research_leads for follow-up / outreach.
--
-- Safety:
--   • Additive only. Re-runnable (IF NOT EXISTS / DROP POLICY IF EXISTS).
--   • New tables only. public.businesses / audit_submissions / admin_*
--     pipeline + outreach tables are untouched.
--   • Nothing here contacts anyone or auto-sends messages. It only stores
--     real Google Places results the founder chooses to keep.
--   • RLS: founder_admin via is_founder_admin() (migration 20260518120000);
--     server routes use the service-role client.
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger fn (created by the admin pipeline migration;
-- re-declared here so this migration is self-sufficient / re-runnable).
CREATE OR REPLACE FUNCTION public.admin_pipeline_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Research runs (one row per search task) ────────────────────────
CREATE TABLE IF NOT EXISTS public.research_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  location    text,
  niches      text[] NOT NULL DEFAULT '{}',
  radius_km   integer,
  lead_target integer,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT research_runs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  )
);

COMMENT ON TABLE public.research_runs IS 'Business Research Agent search tasks. Founder-only; results sourced from Google Places.';

CREATE INDEX IF NOT EXISTS research_runs_created_idx ON public.research_runs (created_at DESC);

DROP TRIGGER IF EXISTS research_runs_set_updated_at ON public.research_runs;
CREATE TRIGGER research_runs_set_updated_at
  BEFORE UPDATE ON public.research_runs
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── Research leads (saved, qualified businesses) ───────────────────
CREATE TABLE IF NOT EXISTS public.research_leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_run_id     uuid REFERENCES public.research_runs(id) ON DELETE CASCADE,
  business_name       text NOT NULL,
  niche               text,
  address             text,
  phone               text,
  website             text,
  google_maps_url     text,
  rating              numeric,
  review_count        integer,
  problem_found       text,
  outreach_angle      text,
  first_dm            text,
  cold_email_opening  text,
  lead_score          integer,
  status              text NOT NULL DEFAULT 'new',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT research_leads_status_check CHECK (
    status IN ('new', 'reviewing', 'qualified', 'contacted', 'archived')
  )
);

COMMENT ON TABLE public.research_leads IS 'Saved, rule-scored businesses from a research run. Real Google Places data only.';

CREATE INDEX IF NOT EXISTS research_leads_run_idx    ON public.research_leads (research_run_id);
CREATE INDEX IF NOT EXISTS research_leads_status_idx ON public.research_leads (status);
CREATE INDEX IF NOT EXISTS research_leads_score_idx  ON public.research_leads (lead_score DESC);

-- Duplicate guard: one saved lead per Google Maps URL (the strongest dedupe
-- key). Postgres treats NULLs as distinct, so URL-less rows are allowed to
-- repeat here and are instead deduped in the save route by
-- business_name + address + research_run_id.
CREATE UNIQUE INDEX IF NOT EXISTS research_leads_gmaps_url_key
  ON public.research_leads (google_maps_url);

DROP TRIGGER IF EXISTS research_leads_set_updated_at ON public.research_leads;
CREATE TRIGGER research_leads_set_updated_at
  BEFORE UPDATE ON public.research_leads
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── Row Level Security — founder_admin only ────────────────────────
ALTER TABLE public.research_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_runs  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.research_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_leads FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rr_select_founder_admin ON public.research_runs;
DROP POLICY IF EXISTS rr_insert_founder_admin ON public.research_runs;
DROP POLICY IF EXISTS rr_update_founder_admin ON public.research_runs;
DROP POLICY IF EXISTS rr_delete_founder_admin ON public.research_runs;

CREATE POLICY rr_select_founder_admin ON public.research_runs
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY rr_insert_founder_admin ON public.research_runs
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY rr_update_founder_admin ON public.research_runs
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY rr_delete_founder_admin ON public.research_runs
  FOR DELETE TO authenticated USING (public.is_founder_admin());

DROP POLICY IF EXISTS rl_select_founder_admin ON public.research_leads;
DROP POLICY IF EXISTS rl_insert_founder_admin ON public.research_leads;
DROP POLICY IF EXISTS rl_update_founder_admin ON public.research_leads;
DROP POLICY IF EXISTS rl_delete_founder_admin ON public.research_leads;

CREATE POLICY rl_select_founder_admin ON public.research_leads
  FOR SELECT TO authenticated USING (public.is_founder_admin());
CREATE POLICY rl_insert_founder_admin ON public.research_leads
  FOR INSERT TO authenticated WITH CHECK (public.is_founder_admin());
CREATE POLICY rl_update_founder_admin ON public.research_leads
  FOR UPDATE TO authenticated USING (public.is_founder_admin()) WITH CHECK (public.is_founder_admin());
CREATE POLICY rl_delete_founder_admin ON public.research_leads
  FOR DELETE TO authenticated USING (public.is_founder_admin());
