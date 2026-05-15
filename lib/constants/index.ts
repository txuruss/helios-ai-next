// ── App ───────────────────────────────────────────────────────────
export const APP_NAME = 'Helios AI'
export const APP_TAGLINE = 'AI systems that turn missed leads into booked customers.'
export const APP_DESCRIPTION =
  'Helios AI builds AI booking systems, lead capture flows, WhatsApp automations, and operations dashboards for local service businesses.'

// ── Navigation ────────────────────────────────────────────────────
export const NAV_LINKS = [
  { label: 'Services',    href: '/#services'   },
  { label: 'Process',     href: '/#process'    },
  { label: 'Platform',    href: '/#platform'   },
  { label: 'Case Studies',href: '/#results'    },
  { label: 'Pricing',     href: '/#pricing'    },
  { label: 'Contact',     href: '/#contact'    },
]

export const DASHBOARD_NAV = [
  { id: 'overview',    label: 'Overview',       href: '/dashboard',             icon: 'LayoutDashboard' },
  { id: 'agents',      label: 'AI Agents',      href: '/dashboard/agents',      icon: 'Bot'             },
  { id: 'leads',       label: 'Leads',          href: '/dashboard/leads',       icon: 'Users'           },
  { id: 'bookings',    label: 'Bookings',       href: '/dashboard/bookings',    icon: 'Calendar'        },
  { id: 'services',    label: 'Services',       href: '/dashboard/services',    icon: 'Briefcase'       },
  { id: 'business',    label: 'Business',       href: '/dashboard/business',    icon: 'Building2'       },
  { id: 'calcom',      label: 'Cal.com',        href: '/dashboard/calcom',      icon: 'Link'            },
  { id: 'whatsapp',   label: 'WhatsApp',       href: '/dashboard/whatsapp',    icon: 'MessageCircle'   },
  { id: 'widget',      label: 'Widget',         href: '/dashboard/widget',      icon: 'MessageSquare'   },
  { id: 'settings',    label: 'Settings',       href: '/dashboard/settings',    icon: 'Settings'        },
] as const

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
export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter System',
    tagline: 'For businesses that need lead capture and faster replies.',
    outcome: 'Stop missing inquiries and reply 24/7.',
    features: [
      'AI opportunity audit',
      'Lead capture form',
      'Basic AI assistant',
      'Website embed',
      'Email notifications',
      'Basic dashboard',
    ],
    cta: 'Start with Starter',
    featured: false,
  },
  {
    id: 'growth',
    name: 'Growth System',
    tagline: 'For businesses that want AI booking, calendar sync, and client tracking.',
    outcome: 'Turn your website into a 24/7 booking engine.',
    badge: 'Most Popular',
    features: [
      'Everything in Starter',
      'AI booking assistant',
      'Calendar integration',
      'Service mapping',
      'Lead qualification',
      'Client dashboard',
      'Monthly performance report',
    ],
    cta: 'Book Growth Call',
    featured: true,
  },
  {
    id: 'command',
    name: 'Command Center',
    tagline: 'For businesses that want a full AI operations dashboard.',
    outcome: 'Manage leads, clients, bookings, agents, and reports from one system.',
    features: [
      'Everything in Growth',
      'Mission Control dashboard',
      'AI Agent Hub',
      'WhatsApp automation',
      'Client onboarding system',
      'Advanced analytics',
      'Priority support',
      'Monthly optimization',
    ],
    cta: 'Build My Command Center',
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
