// ── App ───────────────────────────────────────────────────────────
export const APP_NAME = 'Helios AI'
export const APP_TAGLINE = 'Stop Missing Customers While You\'re Busy Working.'
export const APP_DESCRIPTION =
  'Helios AI replies to customers, answers FAQs, captures leads, books appointments, and alerts you instantly through website chat and WhatsApp.'
export const APP_POSITIONING =
  'Built for barbershops, salons, spas, clinics, repair shops, and appointment-based local businesses.'

// ── Navigation ────────────────────────────────────────────────────
export const NAV_LINKS = [
  { label: 'Services',    href: '/#services'   },
  { label: 'Process',     href: '/#process'    },
  { label: 'Platform',    href: '/#platform'   },
  { label: 'Case Studies',href: '/#results'    },
  { label: 'Pricing',     href: '/#pricing'    },
  { label: 'Contact',     href: '/#contact'    },
]

// Nav items with group support for sidebar grouping
export const DASHBOARD_NAV = [
  // Core — primary workflow
  { id: 'overview',  label: 'Mission Control', href: '/dashboard',          icon: 'LayoutDashboard', group: 'Core'       },
  { id: 'inbox',     label: 'Inbox',           href: '/dashboard/inbox',    icon: 'Inbox',           group: 'Core'       },
  { id: 'bookings',  label: 'Bookings',        href: '/dashboard/bookings', icon: 'Calendar',        group: 'Core'       },
  { id: 'leads',     label: 'Leads',           href: '/dashboard/leads',    icon: 'Users',           group: 'Core'       },
  // Automation — advanced features
  { id: 'ops',       label: 'Ops Center',      href: '/dashboard/ops',      icon: 'Activity',        group: 'Automation' },
  { id: 'agents',    label: 'AI Agents',       href: '/dashboard/agents',   icon: 'Bot',             group: 'Automation' },
  // Setup — configuration
  { id: 'business',  label: 'Business',        href: '/dashboard/business', icon: 'Building2',       group: 'Setup'      },
  { id: 'services',  label: 'Services',        href: '/dashboard/services', icon: 'Briefcase',       group: 'Setup'      },
  { id: 'calcom',    label: 'Cal.com',         href: '/dashboard/calcom',   icon: 'Link',            group: 'Setup'      },
  { id: 'whatsapp',  label: 'WhatsApp',        href: '/dashboard/whatsapp', icon: 'MessageCircle',   group: 'Setup'      },
  { id: 'widget',    label: 'Widget',          href: '/dashboard/widget',   icon: 'MessageSquare',   group: 'Setup'      },
  // System
  { id: 'settings',  label: 'Settings',        href: '/dashboard/settings', icon: 'Settings',        group: 'System'     },
] as const

export const NAV_GROUPS = ['Core', 'Automation', 'Setup', 'System'] as const
export type NavGroup = typeof NAV_GROUPS[number]

// ── Business types ────────────────────────────────────────────────
export const BUSINESS_TYPES = [
  'Barbershop',
  'Beauty / Spa',
  'Fitness',
  'Home Services',
  'Auto Services',
  'Clinic',
  'Restaurant / Hospitality',
  'Other',
] as const

// ── Lead statuses ─────────────────────────────────────────────────
export const LEAD_STATUSES = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'] as const
export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] as const

// ── Pricing ───────────────────────────────────────────────────────
// Internal plan IDs stay starter/pro/scale to match Stripe.
// Public labels map: starter→Starter, pro→Booking OS, scale→Ops Center.
// setupRange/monthlyRange are the flat public prices shown on pricing cards.
// internalSetupRange/internalMonthlyRange are for internal quoting only — never shown publicly.
export const PLAN_LABEL_MAP: Record<string, string> = {
  starter: 'Starter',
  pro:     'Booking OS',
  scale:   'Ops Center',
  free:    'Free',
}

export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    internalPlan: 'starter',
    tagline: 'Simple website chat, FAQs, and lead capture.',
    outcome: 'Stop missing inquiries. Reply 24/7.',
    bestFor: 'Simple website chat, FAQs, lead capture',
    // Public flat pricing
    setupRange: '$997 setup',
    monthlyRange: '$149/mo',
    // Internal ranges — for quoting reference only, not shown publicly
    internalSetupRange: '$497 to $1,500',
    internalMonthlyRange: '$99 to $299/mo',
    features: [
      'Website AI chat',
      'FAQ answering',
      'Lead capture form',
      'Email notification to owner',
      'Basic dashboard',
      '1 revision round',
    ],
    cta: 'Get Started',
    featured: false,
  },
  {
    id: 'growth',
    name: 'Booking OS',
    internalPlan: 'pro',
    tagline: 'Website chat, WhatsApp, booking flow, and owner notifications.',
    outcome: 'Turn every conversation into a booked appointment.',
    bestFor: 'Website chat, WhatsApp, booking flow, notifications',
    // Public flat pricing
    setupRange: '$2,500 setup',
    monthlyRange: '$399/mo',
    // Internal ranges — for quoting reference only, not shown publicly
    internalSetupRange: '$1,500 to $3,500',
    internalMonthlyRange: '$299 to $750/mo',
    badge: 'Recommended',
    features: [
      'Website AI chat',
      'WhatsApp assistant',
      'FAQ answering',
      'Lead capture',
      'Appointment request flow',
      'Owner notifications',
      'Basic CRM / dashboard',
      'Monthly optimization',
    ],
    cta: 'Book a Demo',
    featured: true,
  },
  {
    id: 'command',
    name: 'Ops Center',
    internalPlan: 'scale',
    tagline: 'Multi-location, dashboard, automation workflows, and reporting.',
    outcome: 'Manage every conversation, booking, and alert from one system.',
    bestFor: 'Multi-location, dashboard, automation workflows, reporting',
    // Public flat pricing
    setupRange: '$5,000 setup',
    monthlyRange: '$999/mo',
    // Internal ranges — for quoting reference only, not shown publicly
    internalSetupRange: '$3,500 to $8,000+',
    internalMonthlyRange: '$750 to $2,000+/mo',
    features: [
      'Full AI booking system',
      'Website chat + WhatsApp automation',
      'Lead dashboard',
      'Client onboarding flow',
      'Admin notifications',
      'Follow-up automation',
      'Analytics / reporting',
      'Priority support',
    ],
    cta: 'Talk to Sales',
    featured: false,
  },
] as const

// ── Agents ────────────────────────────────────────────────────────
export const AGENT_DEFINITIONS = [
  {
    id: 'orchestrator',
    name: 'Helios AI Orchestrator',
    description: 'Routes tasks to specialized agents and manages the full workflow queue.',
    // Phase 2: Anthropic tool config goes here
  },
  {
    id: 'research',
    name: 'Business Research Agent',
    description: 'Researches prospect businesses, services, online presence, and competition.',
  },
  {
    id: 'website-audit',
    name: 'Website Audit Agent',
    description: 'Audits client websites for lead capture gaps, booking flow issues, and SEO.',
  },
  {
    id: 'qualifier',
    name: 'Client Qualifier Agent',
    description: 'Scores inbound leads by business type, budget, and system fit.',
  },
  {
    id: 'sales',
    name: 'Sales Offer Builder',
    description: 'Builds personalized proposals and system packages for qualified prospects.',
  },
  {
    id: 'content',
    name: 'Content & Outreach Agent',
    description: 'Generates follow-up emails, DMs, and outreach sequences for lead nurturing.',
  },
  {
    id: 'qa',
    name: 'Delivery QA Agent',
    description: 'Checks client builds before launch and runs post-optimization quality audits.',
  },
  {
    id: 'admin',
    name: 'Admin Notification Agent',
    description: 'Sends daily digests, internal alerts, and client status update emails.',
  },
] as const
