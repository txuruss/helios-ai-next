-- ════════════════════════════════════════════════════════════════════
-- Research run ownership: created_by_* on research_runs
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Record which team member started each research run so search history
--   can be scoped per agent: outreach_agent sees ONLY their own runs (and
--   therefore only their own results/saved leads), while founder_admin
--   sees everything. Same FK + name/email-snapshot pattern as migration
--   20260608120000 (lead attribution).
--
-- Why this matters for visibility:
--   research_runs.raw_results holds the full scored result set of a run.
--   Without run ownership, one agent could open another agent's run from
--   Research History and see their leads. The server-side query layer
--   (lib/data/admin-research.ts) filters on created_by_team_member_id.
--
-- Safety:
--   • Additive + idempotent: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF
--     NOT EXISTS. Safe to re-run. No data destroyed.
--   • FK uses ON DELETE SET NULL: removing a team member keeps the run
--     and its name/email snapshot.
--   • Existing rows get NULL ownership → treated as founder/legacy runs;
--     agents do not see them (fail closed), founder sees everything.
--   • No RLS changes — founder policies + service-role server reads
--     already cover this table; scoping is enforced in the data layer.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.research_runs
  ADD COLUMN IF NOT EXISTS created_by_team_member_id uuid
    REFERENCES public.team_members(id) ON DELETE SET NULL;
ALTER TABLE public.research_runs
  ADD COLUMN IF NOT EXISTS created_by_name  text;
ALTER TABLE public.research_runs
  ADD COLUMN IF NOT EXISTS created_by_email text;

COMMENT ON COLUMN public.research_runs.created_by_team_member_id IS
  'team_members.id of the member who started this run (NULL for legacy/founder). Drives per-agent search-history scoping.';

CREATE INDEX IF NOT EXISTS research_runs_created_by_idx
  ON public.research_runs (created_by_team_member_id);

-- Verify after running:
--   SELECT id, title, created_by_name, created_by_email
--   FROM public.research_runs ORDER BY created_at DESC LIMIT 10;
