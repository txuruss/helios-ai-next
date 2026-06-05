// ── Role-aware post-login redirect (Lean Baseline) ──────────────
//
// Resolves the correct landing path for a freshly authenticated user.
// Used by:
//   • lib/auth/actions.ts login() — after signInWithPassword succeeds
//   • app/auth/callback/route.ts  — after Supabase email confirmation
//   • app/(auth)/login/page.tsx + app/(auth)/signup/page.tsx — when an
//     already-signed-in user lands on the auth pages
//
// Rules (Lean Baseline):
//   founder_admin                  → /admin/mission-control
//   team_sales / team_delivery /
//   team_content / team_support /
//   team_analyst                   → /dashboard   (team portal is parked)
//   active business member (client) → /dashboard
//   authenticated, no rows yet     → /dashboard
//
// /team/* and /client/* are no longer part of MVP UX. Their pages
// redirect to /dashboard (or /admin for founder), so we never route
// any user there directly.
//
// SECURITY
// • Identity is derived from Supabase server-side ONLY. We accept a
//   userId here, but every caller obtains it from supabase.auth.getUser()
//   first. Never pass a userId from a request body or URL parameter.
// • Role is re-read from team_members on every login. We do not trust
//   any role embedded in cookies or session metadata.
// • Falls back gracefully when team_members has not yet been provisioned
//   in the current environment — without the table, only the client
//   branch can match (which lands on /dashboard).

import 'server-only'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isOutreachAgentAdminRoute } from './permissions'

// ── Default destinations ─────────────────────────────────────────

export const ADMIN_HOME    = '/admin/mission-control'
export const OUTREACH_HOME = '/admin/outreach'
export const CLIENT_HOME   = '/dashboard'
// Lean Baseline: team portal and dashboard setup are parked. Team users
// land on /dashboard like clients; new users also land on /dashboard
// (the page itself handles the no-business case inline).
export const TEAM_HOME   = '/dashboard'
export const SETUP_HOME  = '/dashboard'

// ── Role bucket — used for ACL on redirectTo ─────────────────────

export type RoleBucket =
  | 'founder_admin'
  | 'outreach_agent'
  | 'team'
  | 'client'
  | 'unknown'

interface ResolvedRole {
  bucket:   RoleBucket
  default:  string  // path
  teamRole: string | null
}

// Reads team_members and business_members to compute the user's bucket
// + their default landing path. NEVER trusts client-supplied role.
async function resolveRole(userId: string): Promise<ResolvedRole> {
  // ── team_members lookup ──────────────────────────────────────
  let teamRole: string | null = null
  try {
    const sb = await createClient()
    const { data } = await sb
      .from('team_members')
      .select('role, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    if (data) teamRole = data.role as string
  } catch {
    // Table may not exist yet — fall through to service-role check below.
  }

  if (!teamRole && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = createServiceRoleClient()
      const { data } = await db
        .from('team_members')
        .select('role, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (data) teamRole = data.role as string
    } catch {
      // Table not provisioned — proceed without a team role.
    }
  }

  if (teamRole === 'founder_admin') {
    return { bucket: 'founder_admin', default: ADMIN_HOME, teamRole }
  }

  // Scoped outreach login — lands directly on its only home surface.
  if (teamRole === 'outreach_agent') {
    return { bucket: 'outreach_agent', default: OUTREACH_HOME, teamRole }
  }

  // Lean Baseline: non-founder team members fall through to /dashboard.
  // The /team/* portal is parked, so we no longer route them there.
  const LEGACY = new Set(['sales', 'delivery', 'content', 'support', 'analyst'])
  if (teamRole && (teamRole.startsWith('team_') || LEGACY.has(teamRole))) {
    return { bucket: 'team', default: CLIENT_HOME, teamRole }
  }

  // ── business_members lookup (client) ─────────────────────────
  let hasBusiness = false
  try {
    const sb = await createClient()
    const { data } = await sb
      .from('business_members')
      .select('business_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (data) hasBusiness = true
  } catch { /* swallow */ }

  if (!hasBusiness && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = createServiceRoleClient()
      const { data } = await db
        .from('business_members')
        .select('business_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()
      if (data) hasBusiness = true
    } catch { /* swallow */ }
  }

  if (hasBusiness) {
    return { bucket: 'client', default: CLIENT_HOME, teamRole: null }
  }

  return { bucket: 'unknown', default: SETUP_HOME, teamRole: null }
}

// ── Public API ────────────────────────────────────────────────────

// Default landing path for a user, ignoring any redirectTo parameter.
// Useful when the caller has already validated (or wants to ignore)
// the redirectTo hint.
export async function getPostLoginRedirect(userId: string): Promise<string> {
  const r = await resolveRole(userId)
  return r.default
}

// Returns true when `path` is a safe internal redirect target. Rejects:
//   • null/undefined/empty
//   • non-string values
//   • paths that don't start with `/`
//   • protocol-relative URLs (`//evil.com/...`)
//   • absolute URLs with a scheme (`https://evil.com`)
//   • `javascript:` and similar non-http schemes
//   • paths containing whitespace or control characters
export function isSafeRedirectTo(path: string | null | undefined): boolean {
  if (!path || typeof path !== 'string') return false
  if (path.length === 0 || path.length > 512) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false        // protocol-relative
  if (path.includes('\\')) return false          // backslash injection
  if (/[\s\x00-\x1f]/.test(path)) return false   // whitespace/control
  if (/^[a-z]+:/i.test(path.slice(1))) return false // `/javascript:foo`
  return true
}

// Decides whether a user with `bucket` is allowed to land on `path`.
// Used to enforce that a malicious or hand-crafted redirectTo can't
// drop a client into /admin.
export function canAccessPath(bucket: RoleBucket, path: string): boolean {
  // /admin/* — founder_admin everywhere; outreach_agent only on its
  // allowlisted routes (same source of truth as the route guard).
  if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?')) {
    if (bucket === 'founder_admin') return true
    if (bucket === 'outreach_agent') return isOutreachAgentAdminRoute(path)
    return false
  }
  // /team/* and /client/* are parked in the Lean Baseline. They still
  // exist as redirect stubs to /dashboard, but we refuse to honor them
  // as a redirectTo target — the role default is always more useful.
  if (path === '/team' || path.startsWith('/team/') || path.startsWith('/team?')) {
    return false
  }
  if (path === '/client' || path.startsWith('/client/') || path.startsWith('/client?')) {
    return false
  }
  // Everything else (`/dashboard`, `/booking`, public pages) is
  // accessible to any authenticated user. The destination's own auth
  // guards (e.g. dashboard layout) will re-check identity.
  return true
}

// Main entry point. Resolves the user's role bucket, then either honors
// a safe and permitted redirectTo or falls back to the role default.
export async function getSafePostLoginRedirect(
  userId: string,
  requestedRedirectTo: string | null | undefined,
): Promise<string> {
  const r = await resolveRole(userId)

  if (!isSafeRedirectTo(requestedRedirectTo)) {
    return r.default
  }

  const target = requestedRedirectTo as string
  if (!canAccessPath(r.bucket, target)) {
    return r.default
  }

  return target
}
