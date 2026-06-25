// ── App ───────────────────────────────────────────────────────────
export const APP_NAME = 'Helios AI'
export const APP_TAGLINE = 'Stop Missing Customers While You\'re Busy Working.'
export const APP_DESCRIPTION =
  'Helios AI replies to customers, answers FAQs, captures leads, books appointments, and alerts you instantly through website chat and WhatsApp.'
export const APP_POSITIONING =
  'Built for barbershops, salons, spas, clinics, repair shops, and appointment-based local businesses.'

// ── Navigation ────────────────────────────────────────────────────
export const NAV_LINKS = [
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Industries',   href: '/industries'   },
  { label: 'Pricing',      href: '/pricing'      },
  { label: 'Free Audit',   href: '/audit'        },
]

// Lean MVP navigation — only the active client workspace routes.
// Parked routes (agents, ops, templates, calcom, whatsapp, widget,
// onboarding, delivery, audits, chat-test, setup) have been removed
// from the sidebar; their page files now redirect to /dashboard.
export const DASHBOARD_NAV = [
  // Core — primary workflow
  { id: 'overview', label: 'Overview',  href: '/dashboard',          icon: 'LayoutDashboard', group: 'Core'  },
  { id: 'inbox',    label: 'Inbox',     href: '/dashboard/inbox',    icon: 'Inbox',           group: 'Core'  },
  { id: 'bookings', label: 'Bookings',  href: '/dashboard/bookings', icon: 'Calendar',        group: 'Core'  },
  { id: 'leads',    label: 'Leads',     href: '/dashboard/leads',    icon: 'Users',           group: 'Core'  },
  // Setup — configuration
  { id: 'business', label: 'Business',  href: '/dashboard/business', icon: 'Building2',       group: 'Setup' },
  { id: 'services', label: 'Services',  href: '/dashboard/services', icon: 'Briefcase',       group: 'Setup' },
  // FAQs — Pinned in MVP spec but no dedicated page yet (Phase 4).
  // System
  { id: 'settings', label: 'Settings',  href: '/dashboard/settings', icon: 'Settings',        group: 'System' },
] as const

export const NAV_GROUPS = ['Core', 'Setup', 'System'] as const
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
// Internal plan IDs stay starter/pro/scale (provider-agnostic).
// Public labels map: starter→Starter, pro→Booking OS, scale→Helios AIOS.
// setupRange/monthlyRange are the flat public prices shown on pricing cards.
// internalSetupRange/internalMonthlyRange are for internal quoting only — never shown publicly.
export const PLAN_LABEL_MAP: Record<string, string> = {
  starter: 'Starter',
  pro:     'Booking OS',
  scale:   'Helios AIOS',
  free:    'Free',
}

// Business model: setup fee (builds the system) + monthly retainer (active
// monthly optimization, monitoring, support, and reporting — never
// "maintenance only"). Canonical package data: lib/billing/packages.ts.
// `features` = what the SETUP builds; `monthlyIncludes` = what the retainer
// actively covers every month.
export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter Lead Response System',
    internalPlan: 'starter',
    tagline: 'A simple system to help local businesses stop missing customer inquiries.',
    outcome: 'Stop missing customer inquiries — every lead is captured and you’re notified instantly.',
    bestFor: 'Small salons, barbershops, solo service providers, and small local businesses',
    // Public flat pricing
    setupRange: '$997 setup',
    monthlyRange: '$149/mo',
    // Internal ranges — for quoting reference only, not shown publicly
    internalSetupRange: '$497 to $1,500',
    internalMonthlyRange: '$99 to $299/mo',
    features: [
      'Website chat or simple lead form',
      'FAQ responses',
      'Customer detail capture',
      'Owner email notification',
      'Basic dashboard',
    ],
    monthlyIncludes: [
      'System monitoring',
      '1 monthly update',
      'Lead-flow check',
      'Basic support',
    ],
    cta: 'Get Started',
    featured: false,
  },
  {
    id: 'growth',
    name: 'Booking OS',
    internalPlan: 'pro',
    tagline: 'A booking and lead-response system that turns customer messages into appointments.',
    outcome: 'Turn customer messages into booked appointments — on the website and WhatsApp.',
    bestFor: 'Spas, med spas, clinics, gyms, busy salons, and appointment-based businesses',
    // Public flat pricing
    setupRange: '$2,500 setup',
    monthlyRange: '$399/mo',
    // Internal ranges — for quoting reference only, not shown publicly
    internalSetupRange: '$1,500 to $3,500',
    internalMonthlyRange: '$299 to $750/mo',
    badge: 'Recommended',
    features: [
      'Website chat',
      'WhatsApp assistant',
      'Booking request flow',
      'FAQ automation',
      'Lead dashboard',
      'Owner/team notifications',
      'Follow-up messages',
    ],
    monthlyIncludes: [
      'Monthly optimization',
      'Lead-flow review',
      'Monthly reporting',
      'Monitoring and support',
    ],
    cta: 'Book a Demo',
    featured: true,
  },
  {
    id: 'command',
    name: 'Helios AIOS',
    internalPlan: 'scale',
    tagline: 'A complete AI operating system for inquiries, bookings, follow-ups, and lead management.',
    outcome: 'Give your business one AI-powered command center for inquiries, bookings, follow-ups, and customer lead visibility.',
    bestFor: 'Larger service businesses, med spas, clinics, multi-service teams, and businesses that need stronger lead management',
    // Public flat pricing
    setupRange: '$5,000 setup',
    monthlyRange: '$999/mo',
    // Internal ranges — for quoting reference only, not shown publicly
    internalSetupRange: '$3,500 to $8,000+',
    internalMonthlyRange: '$750 to $2,000+/mo',
    features: [
      'Full AI booking system',
      'Website chat assistant',
      'WhatsApp assistant',
      'Lead capture dashboard',
      'Inquiry routing',
      'Client intake flow',
      'Follow-up automation',
      'Owner/team notifications',
      'Lead status tracking',
      'Reporting dashboard',
    ],
    monthlyIncludes: [
      'Monthly optimization',
      'Lead-flow review',
      'Analytics and reporting',
      'Priority support',
      'Monthly strategy review',
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
    description: 'Builds personalized proposals: recommended package, setup fee, monthly retainer, setup vs monthly deliverables, and next step.',
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
