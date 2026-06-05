-- ════════════════════════════════════════════════════════════════════
-- Saved-by / created-by attribution for research leads + outreach leads
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Record which team member saved a research lead and which team member
--   added an outreach lead, so the dashboard can show "Saved by". Both a
--   relational link (FK to team_members) AND a name/email snapshot are
--   stored — the snapshot keeps the display stable even if the team member
--   is later renamed or removed.
--
-- Why a NEW migration (not an edit of the originals):
--   20260606120000 (research_leads) and 20260605120000 (admin_outreach_leads)
--   are already applied. Editing an applied migration would NOT re-run in an
--   already-migrated database (so the columns would never appear) and risks
--   drift between environments. Additive, idempotent migrations are the safe
--   pattern here.
--
-- Safety:
--   • Additive + idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT
--     EXISTS. Safe to re-run. No data destroyed, no column removed.
--   • FK uses ON DELETE SET NULL: removing a team member nulls the link but
--     keeps the name/email snapshot, so the display never breaks.
--   • No RLS changes: founder_admin policies + service-role server writes
--     already cover these tables; the new columns are plain data.
--   • Existing rows get NULL attribution → the UI shows "Unknown".
-- ════════════════════════════════════════════════════════════════════

-- ── research_leads: who saved the lead ─────────────────────────────
ALTER TABLE public.research_leads
  ADD COLUMN IF NOT EXISTS saved_by_team_member_id uuid
    REFERENCES public.team_members(id) ON DELETE SET NULL;
ALTER TABLE public.research_leads
  ADD COLUMN IF NOT EXISTS saved_by_name  text;
ALTER TABLE public.research_leads
  ADD COLUMN IF NOT EXISTS saved_by_email text;

COMMENT ON COLUMN public.research_leads.saved_by_team_member_id IS
  'team_members.id of the member who saved this lead (NULL for legacy/unknown). Snapshot in saved_by_name/email keeps display stable.';

CREATE INDEX IF NOT EXISTS research_leads_saved_by_idx
  ON public.research_leads (saved_by_team_member_id);

-- ── admin_outreach_leads: who added the lead ───────────────────────
-- (No existing created_by/owner column — these are new.)
ALTER TABLE public.admin_outreach_leads
  ADD COLUMN IF NOT EXISTS created_by_team_member_id uuid
    REFERENCES public.team_members(id) ON DELETE SET NULL;
ALTER TABLE public.admin_outreach_leads
  ADD COLUMN IF NOT EXISTS created_by_name  text;
ALTER TABLE public.admin_outreach_leads
  ADD COLUMN IF NOT EXISTS created_by_email text;

COMMENT ON COLUMN public.admin_outreach_leads.created_by_team_member_id IS
  'team_members.id of the member who added this outreach lead (NULL for legacy/unknown). Snapshot in created_by_name/email keeps display stable.';

CREATE INDEX IF NOT EXISTS admin_outreach_leads_created_by_idx
  ON public.admin_outreach_leads (created_by_team_member_id);

-- Verify after running:
--   SELECT id, business_name, saved_by_name, saved_by_email
--   FROM public.research_leads ORDER BY saved_at DESC NULLS LAST LIMIT 10;
