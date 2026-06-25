// ── Phase 29: Plan-based feature gating for the client portal ────
//
// Maps the three internal plan IDs (starter / pro / scale) to which
// /client portal features are accessible.
//
//   starter → 'Starter'       — dashboard, business profile, AI status, leads, basic reports
//   pro     → 'Booking OS'    — + bookings, conversations, knowledge base, better analytics
//   scale   → 'Helios AIOS'    — + advanced reports, follow-ups, monthly insights, staff
//
// This is a PURE module. Safe to import from client or server.
//
// IMPORTANT: This is the CLIENT-FACING Helios AIOS, not the internal
// Helios AI Team Ops Control at /team. They are distinct surfaces.

import type { PlanId } from '@/lib/billing/plans'

export type ClientPlan = PlanId | 'free'

// Every plan-gated feature in the client portal.
export const CLIENT_FEATURES = {
  // Starter and above
  dashboard:           'dashboard',
  business_profile:    'business_profile',
  ai_assistant_status: 'ai_assistant_status',
  basic_leads:         'basic_leads',
  basic_reports:       'basic_reports',
  billing:             'billing',
  support:             'support',
  settings:            'settings',
  // Booking OS and above
  booking_management:  'booking_management',
  conversation_review: 'conversation_review',
  faq_management:      'faq_management',
  better_analytics:    'better_analytics',
  // Helios AIOS only
  advanced_command_center: 'advanced_command_center',
  staff_access:            'staff_access',
  workflow_activity:       'workflow_activity',
  advanced_analytics:      'advanced_analytics',
  follow_up_queue:         'follow_up_queue',
  monthly_insights:        'monthly_insights',
  automation_reports:      'automation_reports',
} as const

export type ClientFeature = typeof CLIENT_FEATURES[keyof typeof CLIENT_FEATURES]

const STARTER_FEATURES: ReadonlySet<ClientFeature> = new Set([
  'dashboard',
  'business_profile',
  'ai_assistant_status',
  'basic_leads',
  'basic_reports',
  'billing',
  'support',
  'settings',
])

const BOOKING_OS_ADDITIONAL: ReadonlySet<ClientFeature> = new Set([
  'booking_management',
  'conversation_review',
  'faq_management',
  'better_analytics',
])

const OPS_CENTER_ADDITIONAL: ReadonlySet<ClientFeature> = new Set([
  'advanced_command_center',
  'staff_access',
  'workflow_activity',
  'advanced_analytics',
  'follow_up_queue',
  'monthly_insights',
  'automation_reports',
])

// ── Public API ────────────────────────────────────────────────────

export function planAllowsFeature(plan: ClientPlan, feature: ClientFeature): boolean {
  if (plan === 'free') return false

  if (STARTER_FEATURES.has(feature)) return true
  if (plan === 'starter') return false

  if (BOOKING_OS_ADDITIONAL.has(feature)) return true
  if (plan === 'pro') return false

  if (OPS_CENTER_ADDITIONAL.has(feature)) return true
  return false
}

// Returns the minimum plan required to unlock a feature, used by
// upgrade CTAs to show "Available on Booking OS" / "Available on Helios AIOS".
export function minPlanForFeature(feature: ClientFeature): ClientPlan {
  if (STARTER_FEATURES.has(feature))         return 'starter'
  if (BOOKING_OS_ADDITIONAL.has(feature))    return 'pro'
  return 'scale'
}

// Human-readable label for the gated state.
export function planUpgradeLabel(feature: ClientFeature): string {
  const min = minPlanForFeature(feature)
  if (min === 'pro')    return 'Available on Booking OS'
  if (min === 'scale')  return 'Available on Helios AIOS'
  return 'Available on Starter'
}

// Returns the list of feature keys a plan unlocks. Used to build the
// portal sidebar and show locked/unlocked nav items consistently.
export function featuresForPlan(plan: ClientPlan): ClientFeature[] {
  if (plan === 'free') return []
  const out: ClientFeature[] = [...STARTER_FEATURES]
  if (plan === 'starter') return out
  out.push(...BOOKING_OS_ADDITIONAL)
  if (plan === 'pro') return out
  out.push(...OPS_CENTER_ADDITIONAL)
  return out
}

// ── Display helpers ──────────────────────────────────────────────

export function clientPlanLabel(plan: ClientPlan): string {
  if (plan === 'starter') return 'Starter'
  if (plan === 'pro')     return 'Booking OS'
  if (plan === 'scale')   return 'Helios AIOS'
  return 'Free'
}
