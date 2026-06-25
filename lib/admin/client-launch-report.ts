// ── Client launch readiness report (pure, deterministic) ──────────
//
// Builds a copyable/printable launch readiness report from existing
// readiness data. No DB writes, no API calls, no PayPal, no status
// changes. Works from a LaunchReadinessRow or any equivalent input.

import type { ClientHandoffReadiness } from './client-handoff-readiness'
import type { LaunchState } from './launch-state'
import { STATUS_LABELS } from './client-status'

export interface LaunchReportInput {
  clientName:    string
  plan:          string
  status:        string
  paymentStatus: string | null
  launchState:   LaunchState
  hasHandoffDoc:  boolean
  hasBrandAssets: boolean
  hasSetupDoc:    boolean
  taskTotal:     number
  taskDone:      number
  taskBlocked:   number
  taskOverdue:   number
  readiness:     ClientHandoffReadiness
  nextAction:    string
}

export interface LaunchReportCheck { label: string; value: string }

export interface ClientLaunchReport {
  title:               string
  clientName:          string
  plan:                string
  status:              string
  paymentStatus:       string
  launchRecommendation: string
  summary:             string
  readinessChecks:     LaunchReportCheck[]
  missingItems:        string[]
  blockers:            string[]
  nextAction:          string
  generatedAt:         string
  markdown:            string
}

const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Booking OS', scale: 'Helios AIOS', free: 'Free' }
const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Paid', deposit_paid: 'Deposit Paid', unpaid: 'Unpaid', overdue: 'Overdue', cancelled: 'Cancelled',
}
const RECOMMENDATION: Record<LaunchState, string> = {
  ready: 'Ready to Launch', needs_files: 'Needs Files', needs_payment: 'Needs Payment',
  needs_onboarding: 'Needs Onboarding', blocked: 'Blocked', active: 'Already Active', archived: 'Archived',
}

function planLabel(p: string): string { return PLAN_LABELS[p] ?? (p || '—') }
function paymentLabel(p: string | null): string { return p ? (PAYMENT_LABELS[p] ?? p) : 'Not recorded' }
function statusLabel(s: string): string { return STATUS_LABELS[s as keyof typeof STATUS_LABELS] ?? s }

export function getLaunchRecommendation(input: LaunchReportInput): string {
  return RECOMMENDATION[input.launchState]
}

function summaryFor(state: LaunchState): string {
  if (state === 'ready')    return 'This client appears ready to launch.'
  if (state === 'active')   return 'This client is already marked active.'
  if (state === 'archived') return 'This client is archived.'
  return 'This client is not fully ready to launch yet.'
}

export function getLaunchReportMissingItems(input: LaunchReportInput): string[] {
  const r = input.readiness
  const items: string[] = []
  if (!input.hasHandoffDoc)  items.push('Upload handoff document')
  if (!input.hasBrandAssets) items.push('Upload brand assets')
  if (!input.hasSetupDoc)    items.push('Upload setup document')
  if (r.paymentWarning)      items.push(input.paymentStatus === 'overdue' ? 'Resolve overdue payment' : 'Record client payment')
  if (input.taskTotal === 0) items.push('Create onboarding checklist')
  if (input.taskBlocked > 0) items.push('Resolve blocked onboarding task(s)')
  if (input.taskOverdue > 0) items.push('Complete overdue tasks')
  if (input.taskTotal > 0 && r.openTaskCount > 0 && input.taskBlocked === 0 && input.taskOverdue === 0) {
    items.push('Complete remaining onboarding tasks')
  }
  if (r.onboardingStageWarning) items.push('Mark onboarding stage live/complete')
  return items
}

function blockersFor(input: LaunchReportInput): string[] {
  const out: string[] = []
  if (input.taskBlocked > 0) out.push(`${input.taskBlocked} blocked task${input.taskBlocked !== 1 ? 's' : ''}`)
  if (input.taskOverdue > 0) out.push(`${input.taskOverdue} overdue task${input.taskOverdue !== 1 ? 's' : ''}`)
  if (input.paymentStatus === 'overdue') out.push('Payment overdue')
  else if (input.paymentStatus === 'unpaid') out.push('Payment not recorded')
  return out
}

export function buildClientLaunchReport(input: LaunchReportInput, generatedAt?: string): ClientLaunchReport {
  const recommendation = getLaunchRecommendation(input)
  const summary = summaryFor(input.launchState)
  const missingItems = getLaunchReportMissingItems(input)
  const blockers = blockersFor(input)
  const when = generatedAt ?? new Date().toLocaleString()

  const checks: LaunchReportCheck[] = [
    { label: 'Handoff document', value: input.hasHandoffDoc ? 'Uploaded' : 'Missing' },
    { label: 'Brand assets',     value: input.hasBrandAssets ? 'Uploaded' : 'Missing' },
    { label: 'Setup document',   value: input.hasSetupDoc ? 'Uploaded' : 'Missing' },
    { label: 'Payment',          value: paymentLabel(input.paymentStatus) },
    { label: 'Onboarding tasks', value: `${input.taskDone}/${input.taskTotal} complete` },
    { label: 'Blocked tasks',    value: String(input.taskBlocked) },
    { label: 'Overdue tasks',    value: String(input.taskOverdue) },
  ]

  const lines: string[] = []
  lines.push('Client Launch Readiness Report')
  lines.push('')
  lines.push('Client:')
  lines.push(input.clientName)
  lines.push('')
  lines.push('Plan:')
  lines.push(planLabel(input.plan))
  lines.push('')
  lines.push('Status:')
  lines.push(statusLabel(input.status))
  lines.push('')
  lines.push('Payment:')
  lines.push(paymentLabel(input.paymentStatus))
  lines.push('')
  lines.push('Launch Recommendation:')
  lines.push(recommendation)
  lines.push('')
  lines.push('Summary:')
  lines.push(summary)
  lines.push('')
  lines.push('Readiness Checks:')
  for (const c of checks) lines.push(`- ${c.label}: ${c.value}`)
  lines.push('')
  lines.push('Missing Items:')
  if (missingItems.length === 0) lines.push('- None')
  else for (const m of missingItems) lines.push(`- ${m}`)
  lines.push('')
  lines.push('Blockers:')
  if (blockers.length === 0) lines.push('- None')
  else for (const b of blockers) lines.push(`- ${b}`)
  lines.push('')
  lines.push('Recommended Next Action:')
  lines.push(input.nextAction)
  lines.push('')
  lines.push('Generated:')
  lines.push(when)

  return {
    title: 'Client Launch Readiness Report',
    clientName: input.clientName,
    plan: planLabel(input.plan),
    status: statusLabel(input.status),
    paymentStatus: paymentLabel(input.paymentStatus),
    launchRecommendation: recommendation,
    summary,
    readinessChecks: checks,
    missingItems,
    blockers,
    nextAction: input.nextAction,
    generatedAt: when,
    markdown: lines.join('\n'),
  }
}

export function buildClientLaunchReportMarkdown(input: LaunchReportInput, generatedAt?: string): string {
  return buildClientLaunchReport(input, generatedAt).markdown
}
