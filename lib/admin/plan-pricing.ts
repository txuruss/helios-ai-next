// ── Admin CRM plan → fee defaults ─────────────────────────────────
//
// Canonical plan keys for the agency CRM (admin_leads / admin_clients).
// These match the plan pills already used across the admin UI
// (starter / pro / scale) and the public PricingSection.
//
// Fees are DEFAULTS only — they pre-fill the convert dialog and are
// stored per-client in admin_clients.{setup_fee,monthly_fee}. Once
// stored, MRR/ARR are computed from the stored values, never from this
// map, so editing a client's fee is reflected everywhere.

export type AdminPlan = 'starter' | 'pro' | 'scale'

export const ADMIN_PLANS: AdminPlan[] = ['starter', 'pro', 'scale']

export interface PlanFees {
  label:       string
  setup_fee:   number   // whole USD, one-time
  monthly_fee: number   // whole USD, recurring
  est_value:   number   // default lead estimated_value (first-year-ish anchor)
}

// Defaults match the published setup + monthly retainer model
// (lib/billing/packages.ts): $997 / $2,500 / $5,000 setup,
// $149 / $399 / $999 monthly.
export const PLAN_FEES: Record<AdminPlan, PlanFees> = {
  starter: { label: 'Starter',    setup_fee:  997, monthly_fee: 149, est_value: 1000 },
  pro:     { label: 'Booking OS', setup_fee: 2500, monthly_fee: 399, est_value: 2500 },
  scale:   { label: 'Helios AIOS', setup_fee: 5000, monthly_fee: 999, est_value: 5000 },
}

export function isAdminPlan(v: unknown): v is AdminPlan {
  return v === 'starter' || v === 'pro' || v === 'scale'
}

// Maps loose plan strings from the public audit form (selected_plan can be
// free-text or a public plan name) onto a canonical admin plan, or null.
export function normalizeToAdminPlan(raw: unknown): AdminPlan | null {
  if (isAdminPlan(raw)) return raw
  if (typeof raw !== 'string') return null
  const s = raw.toLowerCase()
  if (s.includes('starter') || s.includes('site'))                 return 'starter'
  if (s.includes('pro') || s.includes('booking') || s.includes('growth')) return 'pro'
  if (s.includes('scale') || s.includes('ops') || s.includes('command'))  return 'scale'
  return null
}

// Fee defaults for a plan (falls back to zeros when plan is unknown).
export function feesForPlan(plan: AdminPlan | null): { setup_fee: number; monthly_fee: number } {
  if (!plan) return { setup_fee: 0, monthly_fee: 0 }
  const f = PLAN_FEES[plan]
  return { setup_fee: f.setup_fee, monthly_fee: f.monthly_fee }
}
