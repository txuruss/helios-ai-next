// ── Phase 29: Server-side guard for /team routes ─────────────────
//
// Use this from /team/*/page.tsx and /team/layout.tsx Server Components.
// Returns a typed TeamSession or redirects to /team/login.
//
// Resolution order:
//   1. Supabase session + team_members row → TeamSession
//   2. No Supabase session → redirect('/team/login?redirectTo=...')
//   3. Mock auth enabled (dev only) → MOCK_TEAM_SESSION
//
// SECURITY: team_members is gated by RLS and team_member_id is the
// authoritative key for all internal actions — never trust a
// team_member_id submitted from the client.

import 'server-only'

import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { mockAuthEnabled, MOCK_TEAM_SESSION } from './mock-session'
import { teamCanAccessRoute } from './permissions'
import type { TeamSession, TeamRole } from './types'

interface RequireTeamOptions {
  /** The route being requested — used both for redirectTo and ACL check */
  path?: string
}

export async function requireTeam(
  options: RequireTeamOptions = {},
): Promise<TeamSession> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const redirectTo = options.path ? `?redirectTo=${encodeURIComponent(options.path)}` : ''
      redirect(`/team/login${redirectTo}`)
    }

    // Look up team membership. The team_members table is created via
    // supabase/migrations/20260518120000_create_team_members.sql. Until
    // that migration runs in a given environment, the SELECT below errors;
    // we catch and fall through. Active-status filter blocks `invited`
    // and `suspended` rows from getting access.
    let teamRow: { id: string; role: string; full_name: string | null; email: string; status: string } | null = null

    try {
      const { data } = await supabase
        .from('team_members')
        .select('id, role, full_name, email, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      teamRow = data ?? null
    } catch {
      // Table may not exist yet — fall through to service role check
    }

    if (!teamRow && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const db = createServiceRoleClient()
        const { data } = await db
          .from('team_members')
          .select('id, role, full_name, email, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()
        teamRow = data ?? null
      } catch {
        // Table not provisioned yet
      }
    }

    if (!teamRow) {
      // Real Supabase user but not a team member — block access
      redirect('/team/login?error=not_authorized')
    }

    const role = normalizeTeamRole(teamRow.role)
    const session: TeamSession = {
      teamMemberId: teamRow.id,
      userId:       user.id,
      email:        teamRow.email,
      fullName:     teamRow.full_name,
      role,
      avatarUrl:    null,
    }

    // Route-level ACL
    if (options.path) {
      const acl = teamCanAccessRoute(session.role, options.path)
      if (!acl.allowed) redirect('/team/dashboard?error=forbidden')
    }

    return session
  }

  // Supabase not configured — dev mock fallback only
  if (mockAuthEnabled()) {
    if (options.path) {
      const acl = teamCanAccessRoute(MOCK_TEAM_SESSION.role, options.path)
      if (!acl.allowed) redirect('/team/dashboard?error=forbidden')
    }
    return MOCK_TEAM_SESSION
  }

  redirect('/team/login')
}

// Pass 31: aligned with the team_members CHECK constraint.
// Accepts the canonical `team_*` values written by the SQL migration AND
// the legacy un-prefixed values (`sales`, `delivery`, etc.) so any dev
// or staging row created before the migration still resolves correctly.
function normalizeTeamRole(raw: string | null | undefined): TeamRole {
  if (raw === 'founder_admin') return 'founder_admin'
  if (raw === 'team_sales'    || raw === 'sales')    return 'team_sales'
  if (raw === 'team_delivery' || raw === 'delivery') return 'team_delivery'
  if (raw === 'team_content'  || raw === 'content')  return 'team_content'
  if (raw === 'team_support'  || raw === 'support')  return 'team_support'
  if (raw === 'team_analyst'  || raw === 'analyst')  return 'team_analyst'
  // Unknown role → least-privilege default
  return 'team_analyst'
}
