// ── Helios AI billing plan definitions ───────────────────────────
// Plan IDs, feature limits, and Stripe price mapping.
// Client-safe — no secrets here.

export type PlanId = 'starter' | 'pro' | 'scale'

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
  id:           PlanId
  name:         string
  price_monthly: number          // display price in USD
  stripe_price_env: string       // env var name holding the Stripe price ID
  limits:       PlanLimits
  badge?:       string
  features:     string[]
}

// ── Plan definitions ──────────────────────────────────────────────

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id:            'starter',
    name:          'Starter',
    price_monthly: 29,
    stripe_price_env: 'NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID',
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
      '1 business & widget',
      '250 AI conversations / month',
      '100 leads / month',
      '50 bookings / month',
      'Powered by Helios AI (required)',
      'Basic support',
    ],
  },

  pro: {
    id:            'pro',
    name:          'Pro',
    price_monthly: 79,
    stripe_price_env: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
    badge:         'Most Popular',
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
      '3 businesses & widgets',
      '2,000 AI conversations / month',
      '1,000 leads / month',
      '500 bookings / month',
      'Remove "Powered by Helios AI"',
      'Cal.com booking enabled',
      'Email notifications',
      'Priority support',
    ],
  },

  scale: {
    id:            'scale',
    name:          'Scale',
    price_monthly: 199,
    stripe_price_env: 'NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID',
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
      '10 businesses & widgets',
      '10,000 AI conversations / month',
      '5,000 leads / month',
      '2,500 bookings / month',
      'Remove "Powered by Helios AI"',
      'Advanced automations (Phase 7)',
      'Team members (Phase 7)',
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
