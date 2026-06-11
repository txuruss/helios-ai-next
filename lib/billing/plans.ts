// ── Helios AI billing plan definitions ───────────────────────────
// Plan IDs, feature limits, and Stripe price mapping.
// Client-safe — no secrets here.

export type PlanId = 'starter' | 'pro' | 'scale'

// Phase 21: Public-facing display names mapped from internal plan IDs.
// Stripe price IDs and internal logic remain unchanged.
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro:     'Booking OS',
  scale:   'Ops Center',
  free:    'Free',
}

export function getPlanDisplayName(planId: string | null | undefined): string {
  return PLAN_DISPLAY_NAMES[planId ?? ''] ?? (planId ? planId.charAt(0).toUpperCase() + planId.slice(1) : 'Free')
}

export interface PlanLimits {
  ai_conversations_month: number
  leads_month:            number
  bookings_month:         number
  widgets:                number
  businesses:             number
  show_powered_by:        'required' | 'optional'
  calcom_enabled:         boolean
  email_notifications:    boolean
  team_members:           number
}

export interface Plan {
  id:                   PlanId
  name:                 string   // internal name (preserved for backward compat)
  displayName:          string   // public-facing label: Starter / Booking OS / Ops Center
  price_monthly:        number   // legacy — kept for backward compat, not shown publicly
  // Public flat pricing shown on landing and billing pages
  setupFeeRange:        string   // e.g. "$997 setup"
  monthlyRange:         string   // e.g. "$149/mo"
  // Internal ranges — for quoting flexibility only, never shown publicly
  internalSetupRange:   string   // e.g. "$497 to $1,500"
  internalMonthlyRange: string   // e.g. "$99 to $299/mo"
  bestFor:              string   // one-line audience description
  recommended:          boolean  // highlight as primary recommended offer
  stripe_price_env:     string   // env var name holding the Stripe price ID
  limits:               PlanLimits
  badge?:               string
  features:             string[]
  cta:                  string   // button label for upgrade
}

// ── Plan definitions ──────────────────────────────────────────────

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id:                   'starter',
    name:                 'Starter',
    displayName:          'Starter',
    price_monthly:        29,                       // legacy — not shown publicly
    setupFeeRange:        '$997 setup',             // flat public price
    monthlyRange:         '$149/mo',                // flat public price
    internalSetupRange:   '$497 to $1,500',         // internal quoting reference only
    internalMonthlyRange: '$99 to $299/mo',         // internal quoting reference only
    bestFor:              'Small salons, barbershops, and solo service providers',
    recommended:          false,
    cta:                  'Start with Starter',
    stripe_price_env:     'NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID',
    limits: {
      ai_conversations_month: 250,
      leads_month:            100,
      bookings_month:         50,
      widgets:                1,
      businesses:             1,
      show_powered_by:        'required',
      calcom_enabled:         false,
      email_notifications:    false,
      team_members:           1,
    },
    features: [
      'Website AI chat',
      'FAQ answering',
      'Lead capture form',
      'Email notification to owner',
      'Basic dashboard',
      '1 revision round',
    ],
  },

  pro: {
    id:                   'pro',
    name:                 'Pro',
    displayName:          'Booking OS',
    price_monthly:        79,                       // legacy — not shown publicly
    setupFeeRange:        '$2,500 setup',           // flat public price
    monthlyRange:         '$399/mo',                // flat public price
    internalSetupRange:   '$1,500 to $3,500',       // internal quoting reference only
    internalMonthlyRange: '$299 to $750/mo',        // internal quoting reference only
    bestFor:              'Spas, clinics, gyms, and appointment-based businesses',
    recommended:          true,
    cta:                  'Upgrade to Booking OS',
    stripe_price_env:     'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
    badge:                'Recommended',
    limits: {
      ai_conversations_month: 2000,
      leads_month:            1000,
      bookings_month:         500,
      widgets:                3,
      businesses:             3,
      show_powered_by:        'optional',
      calcom_enabled:         true,
      email_notifications:    true,
      team_members:           5,
    },
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
  },

  scale: {
    id:                   'scale',
    name:                 'Scale',
    displayName:          'Ops Center',
    price_monthly:        199,                      // legacy — not shown publicly
    setupFeeRange:        '$5,000 setup',           // flat public price
    monthlyRange:         '$999/mo',                // flat public price
    internalSetupRange:   '$3,500 to $8,000+',      // internal quoting reference only
    internalMonthlyRange: '$750 to $2,000+/mo',     // internal quoting reference only
    bestFor:              'Larger service businesses and multi-service teams',
    recommended:          false,
    cta:                  'Upgrade to Ops Center',
    stripe_price_env:     'NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID',
    limits: {
      ai_conversations_month: 10000,
      leads_month:            5000,
      bookings_month:         2500,
      widgets:                10,
      businesses:             10,
      show_powered_by:        'optional',
      calcom_enabled:         true,
      email_notifications:    true,
      team_members:           20,
    },
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
  },
}

// ── Helper functions ──────────────────────────────────────────────

/** Returns limits for a plan. Defaults to starter when plan is 'free' or unrecognised. */
export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  const p = plan as PlanId
  return PLANS[p]?.limits ?? PLANS.starter.limits
}

/** Returns the Plan object. Defaults to starter. */
export function getPlan(planId: string | null | undefined): Plan {
  const p = planId as PlanId
  return PLANS[p] ?? PLANS.starter
}

/** Maps a Stripe price ID from env → PlanId. Returns 'starter' if not found. */
export function getPlanFromPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return 'starter'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID)     return 'pro'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID)   return 'scale'
  return 'starter'
}

/** Returns the Stripe price ID for a plan from env vars. */
export function getPriceIdForPlan(planId: PlanId): string | null {
  const plan = PLANS[planId]
  if (!plan) return null
  return process.env[plan.stripe_price_env] ?? null
}

export const ALL_PLANS: Plan[] = [PLANS.starter, PLANS.pro, PLANS.scale]
