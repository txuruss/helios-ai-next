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
    tagline: 'Website chat + lead capture for appointment-based businesses.',
    outcome: 'Stop missing inquiries. Reply 24/7.',
    bestFor: 'Barbershops, salons, and repair shops getting started with AI.',
    setupRange: '$497 – $1,500',
    monthlyRange: '$99 – $299',
    features: [
      'Website chat assistant',
      'FAQ handling',
      'Lead capture',
      'Owner email notifications',
      'Basic dashboard',
    ],
    cta: 'Get Started',
    featured: false,
  },
  {
    id: 'growth',
    name: 'Booking OS',
    internalPlan: 'pro',
    tagline: 'Website + WhatsApp + Cal.com booking — the full client acquisition system.',
    outcome: 'Turn every conversation into a booked appointment.',
    bestFor: 'Spas, clinics, and studios doing 30+ bookings per month.',
    setupRange: '$1,500 – $3,500',
    monthlyRange: '$299 – $750',
    badge: 'Recommended',
    features: [
      'Website chat assistant',
      'WhatsApp assistant',
      'Cal.com booking flow',
      'Lead capture + qualification',
      'Inbox with human handoff',
      'Owner notifications',
      'Monthly optimization',
    ],
    cta: 'Book a Demo',
    featured: true,
  },
  {
    id: 'command',
    name: 'Ops Center',
    internalPlan: 'scale',
    tagline: 'Full AI operations layer for higher-volume service businesses.',
    outcome: 'Manage every conversation, booking, and alert from one system.',
    bestFor: 'Multi-location or high-volume businesses needing team tools.',
    setupRange: '$3,500 – $8,000',
    monthlyRange: '$750 – $2,000+',
    features: [
      'Everything in Booking OS',
      'Mission Control dashboard',
      'Ops Center + SLA tracking',
      'Team assignment',
      'AI agent activity',
      'Automation monitoring',
      'Advanced reporting',
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
