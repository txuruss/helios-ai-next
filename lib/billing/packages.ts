// ── Helios AI commercial packages: setup fee + monthly retainer ─────
//
// CANONICAL source of truth for the business model:
//   Audit → Setup Project → Monthly Retainer
//
// The setup fee covers building the system. The monthly retainer covers
// ongoing optimization, monitoring, support, reporting, and lead-response
// improvement — it is ACTIVE monthly work, never "maintenance only".
//
// Pure data + helpers. Client-safe — no secrets, no I/O. Product limits
// and Stripe mapping stay in lib/billing/plans.ts; CRM fee defaults stay
// in lib/admin/plan-pricing.ts. Copy shown on the landing page
// (lib/constants PRICING_TIERS) mirrors this file.

import type { PlanId } from './plans'

// Canonical retainer explanation — used in proposals, audit reports, and
// sales material whenever the retainer needs to be explained.
export const RETAINER_EXPLANATION =
  'The setup fee covers building the system. The monthly retainer covers keeping it useful. ' +
  'Each month, we monitor the system, update FAQs, review the lead flow, improve responses, ' +
  'fix issues, and help capture more customer inquiries from your website, WhatsApp, or booking channels.'

// Optional early-client note for proposals (founder decides when to use it).
export const FOUNDER_RATE_NOTE =
  'Founder rate: as one of our early clients, your setup fee and monthly retainer are locked at ' +
  'today’s pricing for as long as you stay on the plan — even as our public pricing increases.'

export type RetainerTier = 'light' | 'standard' | 'advanced'

export const RETAINER_TIER_LABELS: Record<RetainerTier, string> = {
  light:    'Light',
  standard: 'Standard',
  advanced: 'Advanced',
}

export interface PackageDef {
  id:             PlanId
  displayName:    string
  setupFee:       number     // whole USD, one-time
  monthlyFee:     number     // whole USD, recurring
  setupFeeLabel:  string     // "$997"
  monthlyFeeLabel: string    // "$149/mo"
  retainerTier:   RetainerTier
  bestFor:        string     // audience description
  positioning:    string     // one-line positioning statement
  primaryOutcome: string     // the outcome the client buys
  setupIncludes:   string[]  // what the setup project builds
  monthlyIncludes: string[]  // what the retainer actively covers each month
}

export const PACKAGES: Record<PlanId, PackageDef> = {
  starter: {
    id:              'starter',
    displayName:     'Starter Lead Response System',
    setupFee:        997,
    monthlyFee:      149,
    setupFeeLabel:   '$997',
    monthlyFeeLabel: '$149/mo',
    retainerTier:    'light',
    bestFor:         'Small salons, barbershops, solo service providers, and small local businesses',
    positioning:     'A simple system to help local businesses stop missing customer inquiries.',
    primaryOutcome:  'Stop missing customer inquiries — every visitor gets an answer and every lead is captured.',
    setupIncludes: [
      'Website chat or simple lead form',
      'FAQ responses trained on your business',
      'Customer detail capture',
      'Owner email notification on new inquiries',
      'Basic dashboard',
    ],
    monthlyIncludes: [
      'System monitoring',
      '1 monthly update (FAQs, hours, services, or prices)',
      'Lead-flow check',
      'Basic support',
    ],
  },
  pro: {
    id:              'pro',
    displayName:     'Booking OS',
    setupFee:        2500,
    monthlyFee:      399,
    setupFeeLabel:   '$2,500',
    monthlyFeeLabel: '$399/mo',
    retainerTier:    'standard',
    bestFor:         'Spas, med spas, clinics, gyms, busy salons, and appointment-based businesses',
    positioning:     'A booking and lead-response system that helps turn customer messages into appointments.',
    primaryOutcome:  'Turn customer messages into booked appointments — on the website and WhatsApp.',
    setupIncludes: [
      'Website chat',
      'WhatsApp assistant',
      'Booking request flow',
      'FAQ automation',
      'Lead dashboard',
      'Owner/team notifications',
      'Follow-up messages',
    ],
    monthlyIncludes: [
      'System monitoring and issue fixes',
      'Monthly optimization (FAQs, responses, booking flow)',
      'Lead-flow review',
      'Monthly reporting on inquiries and bookings',
      'Support',
    ],
  },
  scale: {
    id:              'scale',
    displayName:     'Ops Center',
    setupFee:        5000,
    monthlyFee:      999,
    setupFeeLabel:   '$5,000',
    monthlyFeeLabel: '$999/mo',
    retainerTier:    'advanced',
    bestFor:         'Larger service businesses, multi-service teams, and businesses that need stronger lead management',
    positioning:     'A full lead management and automation system for businesses that need better control over inquiries, bookings, and follow-ups.',
    primaryOutcome:  'Full control over inquiries, bookings, and follow-ups — one system for the whole team.',
    setupIncludes: [
      'Full AI booking system',
      'Website chat and WhatsApp automation',
      'Lead dashboard',
      'Client intake flow',
      'Admin notifications',
      'Follow-up automation',
    ],
    monthlyIncludes: [
      'System monitoring and issue fixes',
      'Monthly optimization across all channels',
      'Lead-flow review and response improvements',
      'Analytics and monthly reporting',
      'Priority support',
      'Monthly strategy review',
    ],
  },
}

export const ALL_PACKAGES: PackageDef[] = [PACKAGES.starter, PACKAGES.pro, PACKAGES.scale]

/** Package for a plan id; defaults to starter for unknown/legacy values. */
export function getPackage(planId: string | null | undefined): PackageDef {
  return PACKAGES[planId as PlanId] ?? PACKAGES.starter
}

/** Retainer tier implied by a plan ('starter' → light, 'pro' → standard, 'scale' → advanced). */
export function retainerTierForPlan(planId: string | null | undefined): RetainerTier {
  return getPackage(planId).retainerTier
}
