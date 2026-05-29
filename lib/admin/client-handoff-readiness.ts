// ── Handoff readiness (deterministic, pure) ───────────────────────
//
// Decision-support only: computes whether a client looks ready to go
// live/handoff. NEVER blocks activation, never writes, no LLM. Safe to
// import from server + client.
//
// CATEGORY CHECKS (explicit taxonomy + legacy aliases):
//   • Handoff document → 'handoff_document'  (legacy: 'handoff' or is_handoff)
//   • Brand assets     → 'logo' | 'brand_asset'  (legacy: 'asset')
//   • Setup document   → 'setup_document'  (legacy: 'deliverable')
// These mirror the Files & Handoff tab so the rules never conflict.

export interface ReadinessClient {
  payment_status?:   string | null
  onboarding_stage?: string | null
}
// Callers pass NON-archived files only.
export interface ReadinessFile {
  category:    string
  is_handoff?: boolean | null
}
export interface ReadinessTask {
  status:    string
  due_date?: string | null
}

export interface ClientHandoffReadiness {
  ready:                   boolean
  missingHandoffDocument:  boolean
  missingBrandAssets:      boolean
  missingSetupDocument:    boolean
  openTaskCount:           number
  blockedTaskCount:        number
  overdueTaskCount:        number
  paymentWarning:          boolean
  onboardingStageWarning:  boolean
  missingItems:            string[]   // missing deliverables (files / no tasks)
  warnings:                string[]   // softer warnings (tasks open, payment, stage)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getClientHandoffReadiness(
  client: ReadinessClient,
  files:  ReadinessFile[],
  tasks:  ReadinessTask[],
): ClientHandoffReadiness {
  const today = todayIso()

  const missingHandoffDocument = !files.some(
    (f) => f.category === 'handoff_document' || f.category === 'handoff' || f.is_handoff === true,
  )
  const missingBrandAssets = !files.some(
    (f) => f.category === 'logo' || f.category === 'brand_asset' || f.category === 'asset',
  )
  const missingSetupDocument = !files.some(
    (f) => f.category === 'setup_document' || f.category === 'deliverable',
  )

  const open    = tasks.filter((t) => t.status !== 'done')
  const openTaskCount    = open.length
  const blockedTaskCount = tasks.filter((t) => t.status === 'blocked').length
  const overdueTaskCount = open.filter((t) => !!t.due_date && t.due_date! < today).length
  const noTasks          = tasks.length === 0

  const pay = client.payment_status ?? null
  const paymentWarning = pay === 'unpaid' || pay === 'overdue'

  const stage = client.onboarding_stage ?? null
  const onboardingStageWarning = stage !== 'live' && stage !== 'complete'

  const missingItems: string[] = []
  if (missingHandoffDocument) missingItems.push('Handoff document')
  if (missingBrandAssets)     missingItems.push('Brand assets')
  if (missingSetupDocument)   missingItems.push('Setup document')
  if (noTasks)                missingItems.push('No onboarding tasks created')

  const warnings: string[] = []
  if (openTaskCount > 0)    warnings.push(`${openTaskCount} onboarding task${openTaskCount !== 1 ? 's' : ''} still open`)
  if (blockedTaskCount > 0) warnings.push(`${blockedTaskCount} blocked task${blockedTaskCount !== 1 ? 's' : ''}`)
  if (overdueTaskCount > 0) warnings.push(`${overdueTaskCount} overdue task${overdueTaskCount !== 1 ? 's' : ''}`)
  if (paymentWarning)       warnings.push(pay === 'overdue' ? 'Payment overdue' : 'Payment not recorded')
  if (onboardingStageWarning) warnings.push('Onboarding stage not marked live/complete')

  const ready = missingItems.length === 0 && warnings.length === 0

  return {
    ready,
    missingHandoffDocument,
    missingBrandAssets,
    missingSetupDocument,
    openTaskCount,
    blockedTaskCount,
    overdueTaskCount,
    paymentWarning,
    onboardingStageWarning,
    missingItems,
    warnings,
  }
}

// Combined list of everything to review (missing items first, then warnings).
export function getMissingHandoffReadinessItems(
  client: ReadinessClient,
  files:  ReadinessFile[],
  tasks:  ReadinessTask[],
): string[] {
  const r = getClientHandoffReadiness(client, files, tasks)
  return [...r.missingItems, ...r.warnings]
}

export function isClientHandoffReady(readiness: ClientHandoffReadiness): boolean {
  return readiness.ready
}
