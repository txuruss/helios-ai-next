// ── Pass 30: Admin (founder Mission Control) navigation ─────────
// Single source of truth for the admin sidebar. Order here defines
// sidebar order. Icons are lucide-react component names.

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

  // Sales
  { id: 'audits',          label: 'Audits',          href: '/admin/audits',          icon: 'BarChart2', group: 'Sales' },
  { id: 'leads',           label: 'Leads',           href: '/admin/leads',           icon: 'Users',     group: 'Sales' },
  { id: 'clients',         label: 'Clients',         href: '/admin/clients',         icon: 'Building2', group: 'Sales' },
  { id: 'outreach',        label: 'Outreach',        href: '/admin/outreach',        icon: 'Megaphone', group: 'Sales' },

  // Operations
  { id: 'delivery',        label: 'Delivery',        href: '/admin/delivery',        icon: 'ClipboardList', group: 'Operations' },
  { id: 'launch-readiness', label: 'Launch Readiness', href: '/admin/launch-readiness', icon: 'Rocket', group: 'Operations' },

  // Admin
  { id: 'settings',        label: 'Settings',        href: '/admin/settings',        icon: 'Settings',  group: 'Admin' },
]

export const ADMIN_NAV_GROUPS: ReadonlyArray<AdminNavItem['group']> =
  ['Overview', 'Sales', 'Operations', 'Admin']
