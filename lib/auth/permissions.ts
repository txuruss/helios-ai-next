// ── Phase 29: Role-based access control for client + team portals ─
// Pure functions only. No I/O. Safe to import from server and client.

import type { ClientRole, TeamRole, AuthorizationResult } from './types'

// ── Client permissions ────────────────────────────────────────────

// Client roles in increasing privilege order.
const CLIENT_ROLE_RANK: Record<ClientRole, number> = {
  viewer: 0,
  staff:  1,
  admin:  2,
  owner:  3,
}

export function clientRoleHasAtLeast(
  role: ClientRole,
  minimum: ClientRole,
): boolean {
  return CLIENT_ROLE_RANK[role] >= CLIENT_ROLE_RANK[minimum]
}

// ── Team permissions ──────────────────────────────────────────────

// Per-role allowlist of /team sub-routes. founder_admin can see everything.
// Lists are inclusive — the matcher uses startsWith on the path.
const TEAM_ROUTE_ALLOWLIST: Record<TeamRole, readonly string[] | '*'> = {
  founder_admin: '*',
  sales: [
    '/team/dashboard',
    '/team/outreach',
    '/team/audits',
    '/team/pipeline',
    '/team/clients',
    '/team/notes',
    '/team/notifications',
    '/team/tasks',
    '/team/settings',
  ],
  delivery: [
    '/team/dashboard',
    '/team/clients',
    '/team/projects',
    '/team/delivery',
    '/team/qa',
    '/team/agent-runs',
    '/team/notes',
    '/team/notifications',
    '/team/tasks',
    '/team/settings',
  ],
  support: [
    '/team/dashboard',
    '/team/clients',
    '/team/notes',
    '/team/notifications',
    '/team/tasks',
    '/team/settings',
  ],
  analyst: [
    '/team/dashboard',
    '/team/audits',
    '/team/agent-runs',
    '/team/clients',
    '/team/billing-status',
    '/team/notifications',
    '/team/settings',
  ],
}

export function teamCanAccessRoute(
  role: TeamRole,
  path: string,
): AuthorizationResult {
  const allow = TEAM_ROUTE_ALLOWLIST[role]
  if (allow === '*') return { allowed: true }
  const matched = allow.some((prefix) => path === prefix || path.startsWith(prefix + '/'))
  if (matched) return { allowed: true }
  return {
    allowed: false,
    reason: `Your role (${role}) does not have access to ${path}.`,
  }
}

// Used by sidebar to filter nav items by role.
export function teamVisibleRoutes(role: TeamRole, allRoutes: readonly string[]): string[] {
  const allow = TEAM_ROUTE_ALLOWLIST[role]
  if (allow === '*') return [...allRoutes]
  return allRoutes.filter((path) =>
    allow.some((prefix) => path === prefix || path.startsWith(prefix + '/')),
  )
}

// ── business_id scoping helper ────────────────────────────────────

// Returns true when the requested business_id matches the session's
// business_id. Use this before any client-facing SELECT or UPDATE
// that filters by business_id — never trust a business_id from the
// client request body.
export function clientOwnsBusiness(
  sessionBusinessId: string,
  requestedBusinessId: string,
): boolean {
  return sessionBusinessId === requestedBusinessId
}

// ── team_member_id tracking helper ────────────────────────────────

// Stamps an action with the team member who performed it.
// Use when writing audit logs or activity rows from /team routes.
export interface TeamActionStamp {
  team_member_id: string
  performed_by:   string  // email — useful for audit trail readability
}

export function makeTeamActionStamp(
  teamMemberId: string,
  email: string,
): TeamActionStamp {
  return { team_member_id: teamMemberId, performed_by: email }
}
