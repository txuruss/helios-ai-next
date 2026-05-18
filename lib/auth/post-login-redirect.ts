// ── Pass 32: Role-aware post-login redirect ──────────────────────
//
// Resolves the correct landing path for a freshly authenticated user.
// Used by:
//   • lib/auth/actions.ts login() — after signInWithPassword succeeds
//   • app/auth/callback/route.ts  — after Supabase email confirmation
//   • app/(auth)/login/page.tsx + app/(auth)/signup/page.tsx — when an
//     already-signed-in user lands on the auth pages
//
// Rules:
//   founder_admin                 → /admin/mission-control
//   team_sales / team_delivery /
//   team_content / team_support /
//   team_analyst                  → /team/ops
//   active business member (client) → /dashboard
//   authenticated, no rows yet    → /dashboard/setup
//
// SECURITY
// • Identity is derived from Supabase server-side ONLY. We accept a
//   userId here, but every caller obtains it from supabase.auth.getUser()
//   first. Never pass a userId from a request body or URL parameter.
// • Role is re-read from team_members on every login. We do not trust
//   any role embedded in cookies or session metadata.
// • Falls back gracefully when team_members has not yet been provisioned
//   in the current environment — without the table, only the client and
//   setup branches can match.

import 'server-only'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

// ── Default destinations ─────────────────────────────────────────

export const ADMIN_HOME  = '/admin/mission-control'
export const TEAM_HOME   = '/team/ops'
export const CLIENT_HOME = '/dashboard'
export const SETUP_HOME  = '/dashboard/setup'

// ── Role bucket — used for ACL on redirectTo ─────────────────────

export type RoleBucket =
  | 'founder_admin'
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

  // Accept both the canonical team_* values (per the SQL CHECK constraint)
  // and the legacy un-prefixed values for any pre-migration dev rows.
  const LEGACY = new Set(['sales', 'delivery', 'content', 'support', 'analyst'])
  if (teamRole && (teamRole.startsWith('team_') || LEGACY.has(teamRole))) {
    return { bucket: 'team', default: TEAM_HOME, teamRole }
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
// drop a client into /admin or /team.
export function canAccessPath(bucket: RoleBucket, path: string): boolean {
  // /admin/* — founder_admin only
  if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?')) {
    return bucket === 'founder_admin'
  }
  // /team/* — team members + founder_admin (excluding /team/login which is public)
  if (path === '/team' || path.startsWith('/team/') || path.startsWith('/team?')) {
    return bucket === 'founder_admin' || bucket === 'team'
  }
  // /client/* — only authenticated business users (client bucket) and founder_admin
  if (path === '/client' || path.startsWith('/client/') || path.startsWith('/client?')) {
    return bucket === 'founder_admin' || bucket === 'client'
  }
  // Everything else (`/dashboard`, `/booking`, `/demo`, public pages) is
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
