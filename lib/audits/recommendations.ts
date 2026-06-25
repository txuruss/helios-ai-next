// ── Audit recommendation engine ────────────────────────────────────
// Maps audit findings to the right Helios AI package under the
// setup fee + monthly retainer model (Audit → Setup → Monthly Retainer).
// Language rule: never claim guaranteed revenue or assert lost leads
// without evidence — use "may", "could", "should be verified".

import type { AuditInput, AuditScores } from './scoring'
import { PACKAGES, RETAINER_EXPLANATION } from '@/lib/billing/packages'

export interface AuditRecommendation {
  plan:             'starter' | 'pro' | 'scale'
  displayName:      string
  setupFee:         string
  monthlyFee:       string
  reason:           string
  includedFeatures: string[]   // legacy combined list — kept for stored audits
  nextSteps:        string[]
  // Setup-vs-retainer split (optional: audits stored before this model
  // reconstruct without them; the report falls back to includedFeatures).
  setupIncludes?:   string[]
  monthlyIncludes?: string[]
}

// Public flat pricing — sourced from the canonical package definitions.
const PLAN_PRICING: Record<string, { setup: string; monthly: string }> = {
  starter: { setup: `${PACKAGES.starter.setupFeeLabel} setup`, monthly: PACKAGES.starter.monthlyFeeLabel },
  pro:     { setup: `${PACKAGES.pro.setupFeeLabel} setup`,     monthly: PACKAGES.pro.monthlyFeeLabel },
  scale:   { setup: `${PACKAGES.scale.setupFeeLabel} setup`,   monthly: PACKAGES.scale.monthlyFeeLabel },
}

export function determineRecommendation(
  input:       AuditInput,
  scores:      AuditScores,
  businessType: string | null,
): AuditRecommendation {
  // Scale indicators
  const needsScale = (
    scores.overall >= 50 &&
    (businessType?.toLowerCase().includes('multi') ||
     businessType?.toLowerCase().includes('chain') ||
     (input.leadCount > 100 && input.bookingCount > 50))
  )

  // Pro indicators (Booking OS) — appointment business with WhatsApp need
  const needsPro = (
    !needsScale &&
    (input.whatsappConnected ||
     input.calcomConnected ||
     businessType?.toLowerCase().match(/barbershop|salon|spa|clinic|fitness|studio|repair/) ||
     (input.serviceCount > 0 && input.bookingCount > 0))
  )

  if (needsScale) {
    return buildRec('scale', input, scores)
  }
  if (needsPro) {
    return buildRec('pro', input, scores)
  }
  return buildRec('starter', input, scores)
}

function buildRec(
  plan:   'starter' | 'pro' | 'scale',
  input:  AuditInput,
  scores: AuditScores,
): AuditRecommendation {
  const pricing = PLAN_PRICING[plan]

  const configs: Record<typeof plan, Omit<AuditRecommendation, 'setupFee' | 'monthlyFee'>> = {
    starter: {
      plan,
      displayName: 'Starter Lead Response System',
      reason:      'Your business may be missing inquiries when nobody can reply right away. A simple lead-response system answers FAQs, captures customer details, and notifies you instantly when a new inquiry comes in — so slow replies could stop costing you bookings.',
      includedFeatures: [
        'Website AI chat assistant',
        'FAQ answering',
        'Lead capture form',
        'Instant owner email notifications',
        'Basic dashboard',
        '1 revision round',
      ],
      setupIncludes:   PACKAGES.starter.setupIncludes,
      monthlyIncludes: PACKAGES.starter.monthlyIncludes,
      nextSteps: [
        'Complete the onboarding intake at /dashboard/onboarding',
        'Add services and FAQs to /dashboard/services',
        'Install the website widget from /dashboard/widget',
        'Test the AI chat by sending a message through the widget',
        'Verify owner notification email arrives',
      ],
    },
    pro: {
      plan,
      displayName: 'Booking OS',
      reason:      'Your business appears to rely on appointments, so the gap between "inquiry" and "booked" matters most. Booking OS gives you an AI assistant on both website and WhatsApp that replies instantly, handles FAQs, captures leads, and accepts booking requests — with an owner dashboard to manage everything.',
      includedFeatures: [
        'Website AI chat assistant',
        'WhatsApp assistant',
        'FAQ answering',
        'Lead capture and qualification',
        'Appointment request flow via Cal.com',
        'Owner email notifications',
        'Inbox with human handoff',
        'Monthly optimization',
      ],
      setupIncludes:   PACKAGES.pro.setupIncludes,
      monthlyIncludes: PACKAGES.pro.monthlyIncludes,
      nextSteps: [
        'Complete the onboarding intake at /dashboard/onboarding',
        'Connect Cal.com at /dashboard/calcom',
        'Connect WhatsApp Business at /dashboard/whatsapp',
        'Add services, pricing, and FAQs',
        'Test the full booking flow end-to-end',
        'Verify WhatsApp auto-reply and handoff',
      ],
    },
    scale: {
      plan,
      displayName: 'Helios AIOS',
      reason:      'Your business has the volume and complexity that benefits from a full AI operations layer. Helios AIOS gives you Mission Control, team assignment, SLA tracking, automation monitoring, and advanced reporting on top of the full Booking OS.',
      includedFeatures: [
        'Full Booking OS (website + WhatsApp)',
        'Mission Control dashboard',
        'Helios AIOS + SLA tracking',
        'Team assignment',
        'AI agent activity',
        'Automation monitoring',
        'Analytics / reporting',
        'Priority support',
      ],
      setupIncludes:   PACKAGES.scale.setupIncludes,
      monthlyIncludes: PACKAGES.scale.monthlyIncludes,
      nextSteps: [
        'Complete onboarding intake with full team and location details',
        'Connect all booking calendars via Cal.com',
        'Set up WhatsApp for each location or number',
        'Configure SLA policies in Helios AIOS',
        'Set up team members and assignment rules',
        'Run a full QA checklist before launch',
      ],
    },
  }

  return {
    ...configs[plan],
    setupFee:  pricing.setup,
    monthlyFee: pricing.monthly,
  }
}

// ── Report generator ──────────────────────────────────────────────

export function generateMarkdownReport(params: {
  businessName:     string
  businessType:     string | null
  scores:           AuditScores
  findings:         Array<{ severity: string; title: string; description: string; recommendation: string }>
  recommendation:   AuditRecommendation
  revenueRisk:      string
}): string {
  const { businessName, scores, findings, recommendation, revenueRisk } = params

  const criticalCount = findings.filter((f) => f.severity === 'critical').length
  const highCount     = findings.filter((f) => f.severity === 'high').length

  const scoreLabel =
    scores.overall >= 80 ? 'Production Ready' :
    scores.overall >= 60 ? 'Demo Ready' :
    scores.overall >= 40 ? 'Needs Improvement' :
    'Critical Gaps'

  const lines: string[] = [
    `# Helios AI Booking Readiness Audit`,
    `**Business:** ${businessName}`,
    `**Date:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    ``,
    `---`,
    ``,
    `## Overall Deployment Score: ${scores.overall}/100 — ${scoreLabel}`,
    ``,
    `| Category | Score |`,
    `|----------|-------|`,
    `| Customer Response | ${scores.response}/100 |`,
    `| Booking Flow | ${scores.booking}/100 |`,
    `| Lead Capture | ${scores.leadCapture}/100 |`,
    `| Trust & Safety | ${scores.trust}/100 |`,
    `| Automation | ${scores.automation}/100 |`,
    ``,
    `---`,
    ``,
    `## Revenue Risk Estimate`,
    ``,
    revenueRisk,
    ``,
    `---`,
    ``,
    `## Key Gaps Found`,
    ``,
    `${criticalCount} critical issues and ${highCount} high-priority issues identified.`,
    ``,
  ]

  const topFindings = findings.filter((f) => ['critical','high'].includes(f.severity)).slice(0, 6)
  for (const f of topFindings) {
    lines.push(`### ${f.severity === 'critical' ? '🔴' : '🟡'} ${f.title}`)
    lines.push(``)
    lines.push(f.description)
    lines.push(``)
    lines.push(`**Fix:** ${f.recommendation}`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)
  lines.push(`## Recommended Package: ${recommendation.displayName}`)
  lines.push(``)
  lines.push(`**Setup fee:** ${recommendation.setupFee}  |  **Monthly retainer:** ${recommendation.monthlyFee}`)
  lines.push(``)
  lines.push(recommendation.reason)
  lines.push(``)
  if (recommendation.setupIncludes?.length && recommendation.monthlyIncludes?.length) {
    lines.push(`**What the setup includes (one-time build):**`)
    for (const f of recommendation.setupIncludes) lines.push(`- ${f}`)
    lines.push(``)
    lines.push(`**What the monthly retainer covers (active ongoing work):**`)
    for (const f of recommendation.monthlyIncludes) lines.push(`- ${f}`)
  } else {
    // Stored audits from before the setup/retainer split.
    lines.push(`**What's included:**`)
    for (const f of recommendation.includedFeatures) lines.push(`- ${f}`)
  }
  lines.push(``)
  lines.push(`**Why the monthly retainer matters:**`)
  lines.push(``)
  lines.push(RETAINER_EXPLANATION)
  lines.push(``)
  lines.push(`**Next steps:**`)
  for (const s of recommendation.nextSteps) {
    lines.push(`1. ${s}`)
  }
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`*Generated by Helios AI — heliosai.agency*`)

  return lines.join('\n')
}
