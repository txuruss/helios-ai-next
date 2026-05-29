// ── Deterministic client next-action suggestions ─────────────────
//
// Pure functions — no DB, no LLM, no secrets, no writes. Safe to import
// from server and client components. Suggestions are READ-ONLY hints;
// nothing here ever mutates a client, task, or payment.

export type SuggestionSeverity = 'critical' | 'warning' | 'info' | 'success'
export type SuggestionCategory = 'payment' | 'onboarding' | 'delivery' | 'status' | 'handoff'
export type SuggestionActionType =
  | 'collect_payment'
  | 'review_blockers'
  | 'complete_overdue_tasks'
  | 'create_checklist'
  | 'add_due_dates'
  | 'mark_live_review'
  | 'send_handoff'
  | 'review_status'

export interface ClientSuggestion {
  id:                string
  title:             string
  description:       string
  severity:          SuggestionSeverity
  category:          SuggestionCategory
  recommendedAction: string
  actionType:        SuggestionActionType
}

// Minimal shapes so AdminClientRow / AdminClientDetail and ClientTask all fit.
export interface SuggestionClient {
  status?:           string | null
  onboarding_stage?: string | null
  payment_status?:   string | null
  payment_method?:   string | null
  next_payment_due?: string | null
}
export interface SuggestionTask {
  status:    string
  priority?: string | null
  due_date?: string | null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
function soonIso(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
}

// Returns every applicable suggestion, highest priority first.
export function getClientSuggestions(
  client: SuggestionClient,
  tasks:  SuggestionTask[],
): ClientSuggestion[] {
  const today = todayIso()
  const soon  = soonIso()

  const total   = tasks.length
  const done    = tasks.filter((t) => t.status === 'done').length
  const open    = tasks.filter((t) => t.status !== 'done')
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  const overdue = open.filter((t) => !!t.due_date && t.due_date! < today).length
  const dueSoon = open.filter((t) => !!t.due_date && t.due_date! >= today && t.due_date! <= soon).length
  const openWithDue = open.filter((t) => !!t.due_date).length
  const allDone = total > 0 && done === total

  const stage  = client.onboarding_stage ?? null
  const status = client.status ?? null
  const pay    = client.payment_status ?? null

  const out: ClientSuggestion[] = []

  // 1. Overdue payment
  if (pay === 'overdue') {
    out.push({
      id: 'overdue_payment', title: 'Overdue payment', severity: 'critical', category: 'payment',
      description: 'This client has an overdue payment status.',
      recommendedAction: 'Follow up on payment before continuing delivery.',
      actionType: 'collect_payment',
    })
  }
  // 2. Unpaid payment
  if (pay === 'unpaid') {
    out.push({
      id: 'unpaid_payment', title: 'Payment not recorded', severity: 'warning', category: 'payment',
      description: 'No payment has been recorded for this client.',
      recommendedAction: 'Collect payment or update payment status before launch.',
      actionType: 'collect_payment',
    })
  }
  // 3. Blocked tasks
  if (blocked > 0) {
    out.push({
      id: 'blocked_tasks', title: 'Blocked delivery work', severity: 'critical', category: 'delivery',
      description: 'One or more onboarding tasks are blocked.',
      recommendedAction: 'Review blockers and update task status.',
      actionType: 'review_blockers',
    })
  }
  // 4. Overdue tasks
  if (overdue > 0) {
    out.push({
      id: 'overdue_tasks', title: 'Overdue onboarding tasks', severity: 'warning', category: 'delivery',
      description: 'This client has tasks past their due date.',
      recommendedAction: 'Prioritize overdue delivery work.',
      actionType: 'complete_overdue_tasks',
    })
  }
  // 5. No checklist
  if (total === 0) {
    out.push({
      id: 'no_checklist', title: 'No onboarding checklist', severity: 'info', category: 'onboarding',
      description: 'This client does not have onboarding tasks yet.',
      recommendedAction: 'Create the correct onboarding checklist for this plan.',
      actionType: 'create_checklist',
    })
  }
  // 6. Due soon
  if (dueSoon > 0) {
    out.push({
      id: 'due_soon_tasks', title: 'Upcoming onboarding deadlines', severity: 'info', category: 'delivery',
      description: 'This client has tasks due soon.',
      recommendedAction: 'Complete upcoming onboarding work.',
      actionType: 'complete_overdue_tasks',
    })
  }
  // 7. All done but still onboarding
  if (allDone && status === 'onboarding') {
    out.push({
      id: 'ready_to_go_live', title: 'Ready to go live', severity: 'success', category: 'status',
      description: 'All onboarding tasks are complete, but the client is still marked as onboarding.',
      recommendedAction: 'Review and mark the client live when ready.',
      actionType: 'mark_live_review',
    })
  }
  // 8. All done and payment paid
  if (allDone && pay === 'paid') {
    out.push({
      id: 'ready_for_handoff', title: 'Ready for handoff', severity: 'success', category: 'handoff',
      description: 'Delivery work is complete and payment is recorded.',
      recommendedAction: 'Send client handoff or confirm live status.',
      actionType: 'send_handoff',
    })
  }
  // 9. Missing due dates
  if (open.length > 0 && openWithDue === 0) {
    out.push({
      id: 'no_due_dates', title: 'No due dates set', severity: 'info', category: 'delivery',
      description: 'Active onboarding tasks do not have due dates.',
      recommendedAction: 'Add due dates to improve delivery tracking.',
      actionType: 'add_due_dates',
    })
  }
  // 10. Status mismatch
  if (status === 'active' && stage !== 'live' && stage !== 'complete') {
    out.push({
      id: 'status_mismatch', title: 'Status mismatch', severity: 'warning', category: 'status',
      description: 'Client is active, but onboarding stage does not appear complete.',
      recommendedAction: 'Review onboarding stage.',
      actionType: 'review_status',
    })
  }

  return out
}

export function getPrimaryClientSuggestion(
  client: SuggestionClient,
  tasks:  SuggestionTask[],
): ClientSuggestion | null {
  return getClientSuggestions(client, tasks)[0] ?? null
}

export function getSuggestionSeverity(s: ClientSuggestion): SuggestionSeverity {
  return s.severity
}

const ACTION_LABELS: Record<SuggestionActionType, string> = {
  collect_payment:        'Collect payment',
  review_blockers:        'Review blockers',
  complete_overdue_tasks: 'Complete tasks',
  create_checklist:       'Create checklist',
  add_due_dates:          'Add due dates',
  mark_live_review:       'Mark live',
  send_handoff:           'Send handoff',
  review_status:          'Review status',
}

// Short label for the compact "Next: …" table cell.
export function getSuggestionActionLabel(s: ClientSuggestion): string {
  return ACTION_LABELS[s.actionType]
}

// Which drawer tab an action routes to.
export type SuggestionTab = 'overview' | 'payments' | 'onboarding' | 'notes'
export function getSuggestionTab(actionType: SuggestionActionType): SuggestionTab {
  if (actionType === 'collect_payment') return 'payments'
  if (actionType === 'send_handoff')    return 'notes'
  return 'onboarding'
}

const SEVERITY_RANK: Record<SuggestionSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 }
export function suggestionSeverityRank(s: SuggestionSeverity): number {
  return SEVERITY_RANK[s]
}
