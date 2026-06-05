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
import { canAccessAdminRoute, isAdminCapableRole } from './permissions'
import type { TeamSession } from './types'

interface RequireAdminOptions {
  /** The current request path — drives the route-level ACL (and redirectTo) */
  path?: string
}

// Where to send a team member who is denied an /admin route. An
// outreach_agent goes back to their own home (/admin/outreach) rather than
// the parked /team/dashboard; everyone else keeps the original behavior.
function deniedRedirect(role: TeamSession['role']): never {
  if (role === 'outreach_agent') redirect('/admin/outreach')
  redirect('/team/dashboard?error=admin_only')
}

// Layout-level gate for the whole /admin surface. Authenticates and admits
// any admin-capable role WITHOUT inspecting the request path — so it can never
// redirect-loop when the `x-pathname` header is missing from a Server
// Component (the cause of the /admin/outreach black screen for outreach_agent
// in production). Precise per-route access is still enforced by each page's
// own requireAdmin({ path }) / requireFounderAdmin() call.
export async function requireAdminShell(): Promise<TeamSession> {
  const session = await requireTeam({ path: undefined })
  if (isAdminCapableRole(session.role)) return session
  // Authenticated, but not an admin-capable role — block the whole surface.
  console.warn(`[requireAdminShell] blocked non-admin role from /admin: ${session.role}`)
  redirect('/team/dashboard?error=admin_only')
}

// Guards an individual /admin route. founder_admin → full access.
// outreach_agent → only the allowlisted outreach/research routes
// (canAccessAdminRoute). Call sites pass their own hardcoded path, so this is
// the authoritative per-page check (the layout gate above is intentionally
// path-agnostic).
export async function requireAdmin(
  options: RequireAdminOptions = {},
): Promise<TeamSession> {
  // requireTeam handles auth, team_members lookup, and dev mock fallback.
  // We pass path=undefined so we apply our own admin ACL, not the team one.
  const session = await requireTeam({ path: undefined })

  const acl = canAccessAdminRoute(session.role, options.path)
  if (!acl.allowed) deniedRedirect(session.role)

  return session
}

// Founder-only guard. Use for surfaces that must never be reachable by a
// scoped role (e.g. /admin/team, billing, system config). `_options` is
// accepted for call-site symmetry with requireAdmin (path is irrelevant —
// a founder is allowed everywhere).
export async function requireFounderAdmin(
  _options: RequireAdminOptions = {},
): Promise<TeamSession> {
  const session = await requireTeam({ path: undefined })
  if (session.role !== 'founder_admin') deniedRedirect(session.role)
  return session
}

// Outreach-surface guard. Admits founder_admin and outreach_agent for the
// outreach/research routes. This is the explicit, self-documenting gate
// used by the research-agent API routes (equivalent to requireAdmin with
// an outreach path, but named for intent).
export async function requireOutreachAccess(
  options: RequireAdminOptions = {},
): Promise<TeamSession> {
  const session = await requireTeam({ path: undefined })
  const acl = canAccessAdminRoute(session.role, options.path)
  if (!acl.allowed) deniedRedirect(session.role)
  return session
}
