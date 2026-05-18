// ── Pass 30: Server-side guard for /admin routes ─────────────────
//
// /admin is the founder/admin command center (Mission Control). It is
// strictly more restrictive than /team — only the founder_admin role
// is allowed. Other team roles (team_sales, team_delivery, team_content,
// team_support, team_analyst) are redirected to /team/dashboard.
//
// Resolution order:
//   1. requireTeam() establishes a real or dev-mock TeamSession.
//   2. Role is checked against founder_admin via founderCanAccessAdminRoute.
//   3. Non-admins → redirect to /team/dashboard?error=admin_only.
//   4. Unauthenticated → handled by requireTeam (redirects to /team/login).
//
// LOCKOUT RISK
// If the `team_members` table is empty or absent in production, no real
// user has role=founder_admin and requireTeam() will redirect every visit
// to /team/login. Bootstrap procedure is documented in full at:
//   docs/founder-admin-bootstrap.md
//
// Quick reference:
//   1. Sign up via /signup with the founder's email (Supabase user).
//   2. Run the SQL migration: supabase/migrations/20260518120000_create_team_members.sql
//   3. Insert the founder row via service role:
//        INSERT INTO team_members (user_id, role, status, full_name, email)
//        VALUES ('<supabase-user-id>', 'founder_admin', 'active', '<name>', '<email>');
//   4. Sign in at /team/login → /admin/mission-control now opens.
//
// Until that row exists in production, /admin/* is reachable only with
// HELIOS_ENABLE_MOCK_AUTH=true in a non-production env (mock session has
// role=founder_admin).

import 'server-only'

import { redirect } from 'next/navigation'
import { requireTeam } from './require-team'
import { founderCanAccessAdminRoute } from './permissions'
import type { TeamSession } from './types'

interface RequireAdminOptions {
  /** The current request path — used by requireTeam for redirectTo */
  path?: string
}

export async function requireAdmin(
  options: RequireAdminOptions = {},
): Promise<TeamSession> {
  // requireTeam handles auth, team_members lookup, and dev mock fallback.
  // We pass path=undefined so we apply our own admin ACL, not the team one.
  const session = await requireTeam({ path: undefined })

  const acl = founderCanAccessAdminRoute(session.role, options.path)
  if (!acl.allowed) {
    redirect('/team/dashboard?error=admin_only')
  }

  return session
}
