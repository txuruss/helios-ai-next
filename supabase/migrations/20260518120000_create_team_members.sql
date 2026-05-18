-- ════════════════════════════════════════════════════════════════════
-- Pass 31: team_members table + RLS + is_founder_admin() helper
-- ════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Provision the production-safe identity table for internal Helios AI
--   staff and the founder. The /admin and /team route guards
--   (lib/auth/require-admin.ts, lib/auth/require-team.ts) read from this
--   table to enforce role-based access. Without this table, /admin and
--   /team are unreachable in production.
--
-- Identity rules (must hold at all times):
--   • user_id is derived from auth.users(id) via FK with ON DELETE CASCADE.
--   • Role and team_member_id are NEVER trusted from the client — server
--     code always re-reads them from this table within the active session.
--   • Public users and clients have no read access (RLS-enforced).
--   • Founder admins can read all rows; team members can read only their
--     own row.
--   • No client-side path can change a team member's role: UPDATE/INSERT/
--     DELETE policies require is_founder_admin() = true. The service-role
--     key bypasses RLS for backfills and server-side admin tools.
--
-- Safety:
--   • Migration is idempotent: `IF NOT EXISTS` on table, indexes, and
--     policies. Re-running is safe.
--   • No data is destroyed.
--   • No existing tables are altered.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Required extension for gen_random_uuid() ────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 2. team_members table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  full_name         text,
  role              text NOT NULL,
  status            text NOT NULL DEFAULT 'active',
  allowed_sections  text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_members_user_id_unique  UNIQUE (user_id),
  CONSTRAINT team_members_role_check      CHECK (role IN (
    'founder_admin',
    'team_sales',
    'team_delivery',
    'team_content',
    'team_support',
    'team_analyst'
  )),
  CONSTRAINT team_members_status_check    CHECK (status IN (
    'active',
    'invited',
    'suspended'
  ))
);

COMMENT ON TABLE  public.team_members IS 'Internal Helios AI staff. Source of truth for /admin and /team route access.';
COMMENT ON COLUMN public.team_members.role  IS 'founder_admin | team_sales | team_delivery | team_content | team_support | team_analyst';
COMMENT ON COLUMN public.team_members.status IS 'active | invited | suspended';
COMMENT ON COLUMN public.team_members.allowed_sections IS 'Optional fine-grained section overrides — empty array means defaults for the role apply.';

-- ── 3. Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS team_members_email_idx   ON public.team_members (lower(email));
CREATE INDEX IF NOT EXISTS team_members_role_idx    ON public.team_members (role);
CREATE INDEX IF NOT EXISTS team_members_status_idx  ON public.team_members (status);

-- ── 4. updated_at trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.team_members_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_set_updated_at ON public.team_members;
CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.team_members_set_updated_at();

-- ── 5. is_founder_admin() helper ───────────────────────────────────
--
-- SECURITY DEFINER so it can read team_members independently of the
-- caller's RLS. Set search_path to public to avoid hijacking attacks.
-- Returns false (never raises) when there is no auth.uid() or no row.
-- Used both by RLS policies below and (optionally) by other migrations.

CREATE OR REPLACE FUNCTION public.is_founder_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = v_uid
      AND role    = 'founder_admin'
      AND status  = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_founder_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_founder_admin() TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.is_founder_admin() IS
'True when the current auth.uid() is an active founder_admin in team_members. Server-side derived — never trust a client-supplied role.';

-- ── 6. Enable Row Level Security ───────────────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members FORCE  ROW LEVEL SECURITY;

-- ── 7. RLS policies ────────────────────────────────────────────────
--
-- Defaults: with RLS enabled and no matching policy, an action is denied.
-- So anon and public roles get NO access by default. We only add the
-- policies we want, all named explicitly so they can be inspected via
-- pg_policies.

-- SELECT: founder_admin reads everyone
DROP POLICY IF EXISTS team_members_select_founder_admin ON public.team_members;
CREATE POLICY team_members_select_founder_admin
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (public.is_founder_admin());

-- SELECT: active team members read their own row
DROP POLICY IF EXISTS team_members_select_self_active ON public.team_members;
CREATE POLICY team_members_select_self_active
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND status = 'active');

-- INSERT: only founder_admin (other inserts require the service role,
-- which bypasses RLS — used by the future invite/seed flow).
DROP POLICY IF EXISTS team_members_insert_founder_admin ON public.team_members;
CREATE POLICY team_members_insert_founder_admin
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_founder_admin());

-- UPDATE: only founder_admin. This is the policy that explicitly blocks
-- a team member from updating their own role from the client. Without
-- a permissive policy, UPDATE is denied — and we never grant one to
-- authenticated users for their own row.
DROP POLICY IF EXISTS team_members_update_founder_admin ON public.team_members;
CREATE POLICY team_members_update_founder_admin
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING      (public.is_founder_admin())
  WITH CHECK (public.is_founder_admin());

-- DELETE: only founder_admin
DROP POLICY IF EXISTS team_members_delete_founder_admin ON public.team_members;
CREATE POLICY team_members_delete_founder_admin
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (public.is_founder_admin());

-- ── 8. Lockdown notes ──────────────────────────────────────────────
--
-- After this migration, the following access matrix applies:
--
--   anon                       → 0 read, 0 write           (no policy)
--   authenticated, not team    → 0 read, 0 write           (no row visible)
--   authenticated, team_sales  → 1 row (own), 0 write
--   authenticated, team_*      → 1 row (own), 0 write
--   authenticated, founder     → all rows, full write
--   service_role               → bypasses RLS (used for invites/seed)
--
-- The application layer (lib/auth/require-team.ts and
-- lib/auth/require-admin.ts) re-checks role on every page render — RLS
-- is the defense-in-depth layer, not the only one.
