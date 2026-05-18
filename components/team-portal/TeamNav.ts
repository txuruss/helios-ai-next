// ── Phase 29: Team portal navigation definition ──────────────────
// Each item has a route; role filtering is applied at render time via
// lib/auth/permissions.teamCanAccessRoute.

export interface TeamNavItem {
  id:    string
  label: string
  href:  string
  icon:  string
  group: 'Overview' | 'Pipeline' | 'Delivery' | 'Operations' | 'Admin'
}

export const TEAM_NAV: TeamNavItem[] = [
  // Overview
  { id: 'dashboard',     label: 'Dashboard',       href: '/team/dashboard',       icon: 'LayoutDashboard', group: 'Overview' },

  // Pipeline (sales)
  { id: 'pipeline',      label: 'Pipeline',        href: '/team/pipeline',        icon: 'TrendingUp',      group: 'Pipeline' },
  { id: 'audits',        label: 'Audits',          href: '/team/audits',          icon: 'BarChart2',       group: 'Pipeline' },
  { id: 'outreach',      label: 'Outreach',        href: '/team/outreach',        icon: 'Send',            group: 'Pipeline' },
  { id: 'clients',       label: 'Clients',         href: '/team/clients',         icon: 'Building2',       group: 'Pipeline' },

  // Delivery
  { id: 'projects',      label: 'Projects',        href: '/team/projects',        icon: 'FolderKanban',    group: 'Delivery' },
  { id: 'delivery',      label: 'Delivery Tracker',href: '/team/delivery',        icon: 'PackageCheck',    group: 'Delivery' },
  { id: 'qa',            label: 'QA',              href: '/team/qa',              icon: 'ShieldCheck',     group: 'Delivery' },
  { id: 'agent-runs',    label: 'Agent Runs',      href: '/team/agent-runs',      icon: 'Bot',             group: 'Delivery' },

  // Operations
  { id: 'notes',         label: 'Notes',           href: '/team/notes',           icon: 'Notebook',        group: 'Operations' },
  { id: 'notifications', label: 'Notifications',   href: '/team/notifications',   icon: 'Bell',            group: 'Operations' },
  { id: 'tasks',         label: 'Tasks',           href: '/team/tasks',           icon: 'CheckSquare',     group: 'Operations' },

  // Admin
  { id: 'billing-status',label: 'Billing Status',  href: '/team/billing-status',  icon: 'CreditCard',      group: 'Admin' },
  { id: 'settings',      label: 'Settings',        href: '/team/settings',        icon: 'Settings',        group: 'Admin' },
]

export const TEAM_NAV_GROUPS: ReadonlyArray<TeamNavItem['group']> =
  ['Overview', 'Pipeline', 'Delivery', 'Operations', 'Admin']
