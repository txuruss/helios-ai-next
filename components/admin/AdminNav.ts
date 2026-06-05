// ── Pass 30: Admin (founder Mission Control) navigation ─────────
// Single source of truth for the admin sidebar. Order here defines
// sidebar order. Icons are lucide-react component names.

import type { TeamRole } from '@/lib/auth/types'

export interface AdminNavItem {
  id:    string
  label: string
  href:  string
  icon:  string
  group: 'Overview' | 'Sales' | 'Operations' | 'Growth' | 'Admin'
}

export const ADMIN_NAV: AdminNavItem[] = [
  // Overview
  { id: 'mission-control', label: 'Mission Control', href: '/admin/mission-control', icon: 'Compass',   group: 'Overview' },
  { id: 'research-agent',  label: 'Research Agent',  href: '/admin/mission-control/research-agent', icon: 'Telescope', group: 'Overview' },

  // Sales
  { id: 'audits',          label: 'Audits',          href: '/admin/audits',          icon: 'BarChart2', group: 'Sales' },
  { id: 'leads',           label: 'Leads',           href: '/admin/leads',           icon: 'Users',     group: 'Sales' },
  { id: 'clients',         label: 'Clients',         href: '/admin/clients',         icon: 'Building2', group: 'Sales' },
  { id: 'outreach',        label: 'Outreach',        href: '/admin/outreach',        icon: 'Megaphone', group: 'Sales' },

  // Operations
  { id: 'delivery',        label: 'Delivery',        href: '/admin/delivery',        icon: 'ClipboardList', group: 'Operations' },
  { id: 'launch-readiness', label: 'Launch Readiness', href: '/admin/launch-readiness', icon: 'Rocket', group: 'Operations' },

  // Admin
  { id: 'team',            label: 'Team',            href: '/admin/team',            icon: 'UserCog',   group: 'Admin' },
  { id: 'settings',        label: 'Settings',        href: '/admin/settings',        icon: 'Settings',  group: 'Admin' },
]

export const ADMIN_NAV_GROUPS: ReadonlyArray<AdminNavItem['group']> =
  ['Overview', 'Sales', 'Operations', 'Admin']

// Nav items visible to a given role. founder_admin sees everything; an
// outreach_agent sees only their two scoped tools (Research Agent +
// Outreach). This is UI hiding only — the real gate is canAccessAdminRoute
// in lib/auth/permissions.ts, enforced server-side on every route.
const OUTREACH_AGENT_NAV_IDS = new Set(['research-agent', 'outreach'])

export function adminNavForRole(role: TeamRole): AdminNavItem[] {
  if (role === 'founder_admin') return ADMIN_NAV
  if (role === 'outreach_agent') {
    return ADMIN_NAV.filter((item) => OUTREACH_AGENT_NAV_IDS.has(item.id))
  }
  // No other role reaches the admin shell — render no nav links rather than
  // exposing founder routes if one ever does.
  return []
}
