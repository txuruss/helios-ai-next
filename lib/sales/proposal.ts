// ── Sales Offer Builder: proposal generator ─────────────────────────
//
// Builds the canonical Helios AI proposal in clean Markdown around the
// Audit → Setup Project → Monthly Retainer model. Pure + client-safe:
// no I/O, no LLM — it formats founder-reviewed inputs and package data
// from lib/billing/packages.ts. Every proposal includes the recommended
// package, setup fee, monthly retainer, setup vs monthly deliverables,
// why the retainer matters, and a suggested next step.
//
// LANGUAGE RULES (apply to all inputs you pass in):
//   • Never claim guaranteed revenue increases.
//   • Never claim the business is losing leads without direct evidence —
//     use "may be losing inquiries", "could improve response speed",
//     "should be verified".

import {
  getPackage, RETAINER_EXPLANATION, FOUNDER_RATE_NOTE,
  RETAINER_TIER_LABELS, type PackageDef,
} from '@/lib/billing/packages'

export interface ProposalInput {
  businessName:     string
  /** The problem observed during the audit/discovery — use careful, evidence-based language. */
  businessProblem:  string
  /** Plan id: 'starter' | 'pro' | 'scale' (defaults to starter when unknown). */
  plan:             string
  /** Why this package fits this business (one short paragraph). */
  whyThisPackage?:  string
  /** Setup timeline, e.g. "7–14 days from kickoff". */
  timeline?:        string
  /** What the client must provide (FAQs, hours, services, access, etc.). */
  clientNeeds?:     string[]
  /** Suggested next step, e.g. a booking link or reply instruction. */
  nextStep?:        string
  /** Include the early-client founder-rate note. */
  includeFounderRate?: boolean
}

const DEFAULT_CLIENT_NEEDS = [
  'Business hours, services, and current prices',
  'Your top 10 customer questions (FAQs)',
  'Website access (or whoever manages it) for the chat install',
  'WhatsApp Business number, if WhatsApp is part of the package',
  'A primary contact for monthly check-ins',
]

const DEFAULT_NEXT_STEP =
  'Reply to confirm and we’ll schedule the kickoff. Setup starts as soon as the setup fee is received — ' +
  'the monthly retainer begins only after your system is live.'

export function buildProposalMarkdown(input: ProposalInput): string {
  const pkg: PackageDef = getPackage(input.plan)
  const needs = input.clientNeeds && input.clientNeeds.length > 0 ? input.clientNeeds : DEFAULT_CLIENT_NEEDS

  const lines: string[] = [
    `# Helios AI Proposal — ${input.businessName}`,
    ``,
    `**Date:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    ``,
    `---`,
    ``,
    `## Business Problem`,
    ``,
    input.businessProblem.trim(),
    ``,
    `## Recommended System`,
    ``,
    pkg.positioning,
    ``,
    `**Primary outcome:** ${pkg.primaryOutcome}`,
    ``,
    `## Package Recommendation: ${pkg.displayName}`,
    ``,
    `**Best for:** ${pkg.bestFor}.`,
    ``,
  ]

  if (input.whyThisPackage?.trim()) {
    lines.push(input.whyThisPackage.trim(), ``)
  }

  lines.push(
    `| | |`,
    `|---|---|`,
    `| **Setup fee (one-time)** | ${pkg.setupFeeLabel} |`,
    `| **Monthly retainer** | ${pkg.monthlyFeeLabel} (${RETAINER_TIER_LABELS[pkg.retainerTier]} retainer) |`,
    ``,
    `## Setup Deliverables`,
    ``,
    `The setup fee covers building your system:`,
    ``,
    ...pkg.setupIncludes.map((d) => `- ${d}`),
    ``,
    `## Monthly Deliverables`,
    ``,
    `The retainer is active monthly work — not passive maintenance:`,
    ``,
    ...pkg.monthlyIncludes.map((d) => `- ${d}`),
    ``,
    `## Why the Retainer Matters`,
    ``,
    RETAINER_EXPLANATION,
    ``,
    `## Timeline`,
    ``,
    input.timeline?.trim() || 'Setup is typically completed within 7–14 days of kickoff, depending on how quickly we receive your business information.',
    ``,
    `## What We Need From You`,
    ``,
    ...needs.map((n) => `- ${n}`),
    ``,
    `## Next Step`,
    ``,
    input.nextStep?.trim() || DEFAULT_NEXT_STEP,
    ``,
  )

  if (input.includeFounderRate) {
    lines.push(`---`, ``, `> ${FOUNDER_RATE_NOTE}`, ``)
  }

  lines.push(`---`, ``, `*Helios AI — heliosai.agency*`)
  return lines.join('\n')
}
