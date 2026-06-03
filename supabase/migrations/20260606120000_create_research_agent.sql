-- ════════════════════════════════════════════════════════════════════
-- Business Research Agent: research_runs + research_leads
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Founder-driven local-business research. Each "run" records a search
--   task (location + niches) executed against the Google Places API and
--   stores the full scored result set in raw_results (JSON). Saved leads
--   (a subset the founder keeps) live in research_leads.
--
-- Safety:
--   • Additive + idempotent. Safe to re-run: CREATE ... IF NOT EXISTS,
--     ALTER ... ADD COLUMN IF NOT EXISTS, DROP ... IF EXISTS. This also
--     UPGRADES databases where an earlier version of this file was applied.
--   • New tables only. public.businesses / audit_submissions / admin_*
--     pipeline + outreach tables are untouched.
--   • Nothing here contacts anyone or auto-sends messages.
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

-- ── Research runs (one row per search task; holds the full result set) ──
CREATE TABLE IF NOT EXISTS public.research_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text,
  location         text,
  niches           text[] NOT NULL DEFAULT '{}',
  radius_km        integer,
  lead_target      integer,        -- requested lead count
  leads_found      integer,        -- results found
  qualified_count  integer,        -- results scoring >= the qualified threshold
  saved_lead_count integer,        -- leads saved to research_leads at run time
  error_message    text,
  raw_results      jsonb,          -- full scored result set
  status           text NOT NULL DEFAULT 'pending',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT research_runs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  )
);

-- Upgrade path for databases created by an earlier version of this file.
ALTER TABLE public.research_runs ADD COLUMN IF NOT EXISTS leads_found      integer;
ALTER TABLE public.research_runs ADD COLUMN IF NOT EXISTS qualified_count  integer;
ALTER TABLE public.research_runs ADD COLUMN IF NOT EXISTS saved_lead_count integer;
ALTER TABLE public.research_runs ADD COLUMN IF NOT EXISTS error_message    text;
ALTER TABLE public.research_runs ADD COLUMN IF NOT EXISTS raw_results      jsonb;

COMMENT ON TABLE public.research_runs IS 'Business Research Agent search tasks + full scored results (raw_results). Founder-only.';

CREATE INDEX IF NOT EXISTS research_runs_created_idx ON public.research_runs (created_at DESC);

DROP TRIGGER IF EXISTS research_runs_set_updated_at ON public.research_runs;
CREATE TRIGGER research_runs_set_updated_at
  BEFORE UPDATE ON public.research_runs
  FOR EACH ROW EXECUTE FUNCTION public.admin_pipeline_set_updated_at();

-- ── Research leads (SAVED leads only — the founder's research CRM) ──────
CREATE TABLE IF NOT EXISTS public.research_leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_run_id     uuid REFERENCES public.research_runs(id) ON DELETE CASCADE,
  place_id            text,
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
  is_saved            boolean NOT NULL DEFAULT true,
  saved_at            timestamptz,
  status              text NOT NULL DEFAULT 'saved',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT research_leads_status_check CHECK (
    status IN ('found', 'saved', 'ready_for_outreach', 'new', 'reviewing', 'qualified', 'contacted', 'archived')
  )
);

-- Upgrade path for databases created by an earlier version of this file.
ALTER TABLE public.research_leads ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE public.research_leads ADD COLUMN IF NOT EXISTS is_saved boolean NOT NULL DEFAULT true;
ALTER TABLE public.research_leads ADD COLUMN IF NOT EXISTS saved_at timestamptz;
ALTER TABLE public.research_leads ALTER COLUMN status SET DEFAULT 'saved';

-- Refresh the status check so 'found'/'saved'/'ready_for_outreach' are allowed.
ALTER TABLE public.research_leads DROP CONSTRAINT IF EXISTS research_leads_status_check;
ALTER TABLE public.research_leads ADD CONSTRAINT research_leads_status_check CHECK (
  status IN ('found', 'saved', 'ready_for_outreach', 'new', 'reviewing', 'qualified', 'contacted', 'archived')
);

COMMENT ON TABLE public.research_leads IS 'Saved research leads (a subset of a run kept by the founder). Real Google Places data only.';

CREATE INDEX IF NOT EXISTS research_leads_run_idx    ON public.research_leads (research_run_id);
CREATE INDEX IF NOT EXISTS research_leads_status_idx ON public.research_leads (status);
CREATE INDEX IF NOT EXISTS research_leads_score_idx  ON public.research_leads (lead_score DESC);

-- Duplicate guard: a business appears at most once PER RUN (by Google Maps
-- URL). Intentionally NOT global — the same business may appear in different
-- runs. Richer dedupe (place id / domain / phone / name+address) is done in
-- the API. Drop the old global index if it exists from a prior version.
DROP INDEX IF EXISTS public.research_leads_gmaps_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS research_leads_run_gmaps_key
  ON public.research_leads (research_run_id, google_maps_url)
  WHERE google_maps_url IS NOT NULL;

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
