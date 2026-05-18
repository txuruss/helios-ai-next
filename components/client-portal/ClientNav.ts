// ── Phase 29: Client portal navigation definition ─────────────────
// The sidebar consults this list and plan-access.ts to decide what to
// show and what to lock.

import type { ClientFeature } from '@/lib/plans/plan-access'

export interface ClientNavItem {
  id:       string
  label:    string
  href:     string
  icon:     string
  group:    'Workspace' | 'Operations' | 'Account'
  feature:  ClientFeature
}

export const CLIENT_NAV: ClientNavItem[] = [
  // Workspace — Starter and above
  { id: 'dashboard',    label: 'Dashboard',          href: '/client/dashboard',         icon: 'LayoutDashboard', group: 'Workspace',  feature: 'dashboard'           },
  { id: 'business',     label: 'Business Profile',   href: '/client/business-profile',  icon: 'Building2',       group: 'Workspace',  feature: 'business_profile'    },
  { id: 'ai',           label: 'AI Assistant',       href: '/client/ai-assistant',      icon: 'Bot',             group: 'Workspace',  feature: 'ai_assistant_status' },
  { id: 'leads',        label: 'Leads',              href: '/client/leads',             icon: 'Users',           group: 'Workspace',  feature: 'basic_leads'         },

  // Operations — Booking OS and above
  { id: 'bookings',     label: 'Bookings',           href: '/client/bookings',          icon: 'Calendar',        group: 'Operations', feature: 'booking_management'  },
  { id: 'conversations',label: 'Conversations',      href: '/client/conversations',     icon: 'MessageSquare',   group: 'Operations', feature: 'conversation_review' },
  { id: 'knowledge',    label: 'Knowledge Base',     href: '/client/knowledge-base',    icon: 'BookOpen',        group: 'Operations', feature: 'faq_management'      },
  { id: 'reports',      label: 'Reports',            href: '/client/reports',           icon: 'BarChart2',       group: 'Operations', feature: 'basic_reports'       },

  // Account — Starter and above
  { id: 'billing',      label: 'Billing',            href: '/client/billing',           icon: 'CreditCard',      group: 'Account',    feature: 'billing'             },
  { id: 'support',      label: 'Support',            href: '/client/support',           icon: 'LifeBuoy',        group: 'Account',    feature: 'support'             },
  { id: 'settings',     label: 'Settings',           href: '/client/settings',          icon: 'Settings',        group: 'Account',    feature: 'settings'            },
]

export const CLIENT_NAV_GROUPS: ReadonlyArray<ClientNavItem['group']> = ['Workspace', 'Operations', 'Account']
