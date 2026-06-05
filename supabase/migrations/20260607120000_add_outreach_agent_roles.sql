-- ════════════════════════════════════════════════════════════════════
-- Add outreach_agent role + allowed_tools to team_members
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Give the client-outreach team scoped dashboard logins. This EXTENDS
--   the existing team_members table (created in
--   20260518120000_create_team_members.sql) — it does NOT create a new
--   table. The existing /admin and /team route guards keep reading the
--   same table, so founder login is unaffected.
--
-- What changes:
--   1. The role CHECK constraint gains three new values (outreach_agent,
--      delivery_agent, viewer). All existing roles are preserved.
--   2. A new allowed_tools text[] column (defaults to the outreach tools).
--   3. The three outreach workers are linked to team_members — but ONLY
--      if their Supabase auth user already exists (see "Account setup"
--      below). The seed is idempotent and never errors if they don't.
--
-- Account setup (passwords NEVER live in this table):
--   1. Create each worker in Supabase Dashboard → Authentication → Users
--      → Add user (email + temporary password, Auto Confirm User).
--   2. Apply this migration (or just re-run section 4 below) to link them
--      as outreach_agent / active.
--   3. They sign in at /login and land on /admin/outreach.
--
-- Safety:
--   • Idempotent: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS,
--     ON CONFLICT DO NOTHING. Re-running is safe.
--   • No data destroyed, no existing role removed, no RLS policy changed.
--   • is_founder_admin() stays founder-only — outreach agents get NO
--     founder RLS powers. Their outreach/research writes run through the
--     service-role server code (the established pattern), gated by the
--     app-layer requireOutreachAccess() / requireAdmin() checks.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Extend the role CHECK constraint (union — nothing removed) ──
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check CHECK (role IN (
    -- existing roles (preserved)
    'founder_admin',
    'team_sales',
    'team_delivery',
    'team_content',
    'team_support',
    'team_analyst',
    -- new roles
    'outreach_agent',
    'delivery_agent',
    'viewer'
  ));

-- ── 2. allowed_tools column (additive; leaves allowed_sections as-is) ─
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS allowed_tools text[] NOT NULL
  DEFAULT '{research_agent,client_outreach}'::text[];

COMMENT ON COLUMN public.team_members.allowed_tools IS
  'Fine-grained tool access for non-founder roles (e.g. research_agent, client_outreach). Founders ignore this — they have full access.';

COMMENT ON COLUMN public.team_members.role IS
  'founder_admin | team_sales | team_delivery | team_content | team_support | team_analyst | outreach_agent | delivery_agent | viewer';

-- ── 3. (no RLS changes — see header) ───────────────────────────────

-- ── 4. Seed the three outreach workers (idempotent) ────────────────
-- Links each worker to team_members ONLY if their auth.users row exists.
-- If you run this BEFORE creating the auth users, it is a harmless no-op;
-- just re-run this section after adding them in the Supabase dashboard.

INSERT INTO public.team_members (user_id, email, full_name, role, status, allowed_tools)
SELECT u.id, 'ephrata@heliosai.agency', 'Ephrata Philipos', 'outreach_agent', 'active',
       '{research_agent,client_outreach}'::text[]
FROM auth.users u
WHERE lower(u.email) = 'ephrata@heliosai.agency'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.team_members (user_id, email, full_name, role, status, allowed_tools)
SELECT u.id, 'felisha@heliosai.agency', 'Felisha Khan', 'outreach_agent', 'active',
       '{research_agent,client_outreach}'::text[]
FROM auth.users u
WHERE lower(u.email) = 'felisha@heliosai.agency'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.team_members (user_id, email, full_name, role, status, allowed_tools)
SELECT u.id, 'uzma@heliosai.agency', 'Uzma Qureshi', 'outreach_agent', 'active',
       '{research_agent,client_outreach}'::text[]
FROM auth.users u
WHERE lower(u.email) = 'uzma@heliosai.agency'
ON CONFLICT (user_id) DO NOTHING;

-- Verify after running:
--   SELECT email, role, status, allowed_tools
--   FROM public.team_members WHERE role = 'outreach_agent';
