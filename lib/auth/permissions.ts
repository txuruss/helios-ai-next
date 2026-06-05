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
  team_sales: [
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
  team_delivery: [
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
  team_content: [
    '/team/dashboard',
    '/team/notes',
    '/team/notifications',
    '/team/tasks',
    '/team/settings',
  ],
  team_support: [
    '/team/dashboard',
    '/team/clients',
    '/team/notes',
    '/team/notifications',
    '/team/tasks',
    '/team/settings',
  ],
  team_analyst: [
    '/team/dashboard',
    '/team/audits',
    '/team/agent-runs',
    '/team/clients',
    '/team/billing-status',
    '/team/notifications',
    '/team/settings',
  ],
  // Scoped roles (20260607120000). These operate on the /admin surface, not
  // the parked /team portal, so they get only a minimal /team allowlist.
  // Their real access is governed by canAccessAdminRoute() below.
  outreach_agent: ['/team/dashboard'],
  delivery_agent: ['/team/dashboard'],
  viewer:         ['/team/dashboard'],
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

// ── Admin (founder) permissions ───────────────────────────────────
// Pass 30: /admin/mission-control surface gates on `founder_admin` only.
// All other team roles must NOT have access to /admin routes. This is
// stricter than the team ACL above — admin is the founder command center.

export function founderCanAccessAdminRoute(role: TeamRole, _path?: string): AuthorizationResult {
  if (role === 'founder_admin') return { allowed: true }
  return {
    allowed: false,
    reason: `The /admin surface is restricted to founder_admin. Your role: ${role}.`,
  }
}

// ── outreach_agent: scoped /admin access ──────────────────────────
// outreach_agent is a limited admin login for the client-outreach team.
// They may reach ONLY these two /admin surfaces — everything else under
// /admin (settings, clients, billing, system, full Mission Control,
// financials) is founder-only. This single allowlist is the source of
// truth, consumed by canAccessAdminRoute() below AND by canAccessPath()
// in post-login-redirect.ts, so there is exactly one definition.
export const OUTREACH_AGENT_ADMIN_ROUTES = [
  '/admin/outreach',
  '/admin/mission-control/research-agent',
] as const

// True when `path` is one of the outreach_agent-allowed admin routes
// (exact match or a sub-path like /admin/outreach?x=y handled by callers,
// which pass the pathname only).
export function isOutreachAgentAdminRoute(path: string): boolean {
  return OUTREACH_AGENT_ADMIN_ROUTES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(prefix + '/') ||
      path.startsWith(prefix + '?'),
  )
}

// Central /admin route ACL. founder_admin → everything. outreach_agent →
// only the allowlisted outreach/research routes. Every other role → denied.
// requireAdmin() delegates here, so this one function gates the admin
// layout (and therefore every /admin page) plus every data/action/API
// call site that passes its path.
export function canAccessAdminRoute(role: TeamRole, path?: string): AuthorizationResult {
  if (role === 'founder_admin') return { allowed: true }
  if (role === 'outreach_agent') {
    if (path && isOutreachAgentAdminRoute(path)) return { allowed: true }
    return {
      allowed: false,
      reason: `outreach_agent may only access ${OUTREACH_AGENT_ADMIN_ROUTES.join(' or ')}.`,
    }
  }
  return {
    allowed: false,
    reason: `The /admin surface is restricted. Your role: ${role}.`,
  }
}

// True when a role may enter the /admin shell AT ALL (i.e. has access to at
// least one admin surface). The admin layout gates on THIS (role membership)
// rather than the request path — so it never needs `x-pathname` and cannot
// redirect-loop when that header is unavailable to a Server Component. The
// precise per-route ACL is still enforced by each page's canAccessAdminRoute.
export function isAdminCapableRole(role: TeamRole): boolean {
  return role === 'founder_admin' || role === 'outreach_agent'
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
