// ── Pure launch-state derivation (server + client safe) ───────────
//
// Single source of truth for a client's launch state, reused by the
// server data helper (/admin/launch-readiness) and the client drawer
// (launch report). Pure, deterministic, no DB/IO.

import {
  getClientHandoffReadiness, type ClientHandoffReadiness,
  type ReadinessClient, type ReadinessFile, type ReadinessTask,
} from './client-handoff-readiness'

export type LaunchState =
  | 'ready' | 'needs_files' | 'needs_payment' | 'needs_onboarding' | 'blocked' | 'active' | 'archived'

export interface LaunchDerived {
  readiness:      ClientHandoffReadiness
  hasHandoffDoc:  boolean
  hasBrandAssets: boolean
  hasSetupDoc:    boolean
  taskTotal:      number
  taskDone:       number
  taskOpen:       number
  taskBlocked:    number
  taskOverdue:    number
  launchState:    LaunchState
  nextAction:     string
}

export function launchNextAction(state: LaunchState, r: ClientHandoffReadiness): string {
  switch (state) {
    case 'active':           return 'Already active'
    case 'archived':         return 'Archived'
    case 'blocked':          return 'Resolve blocked / overdue tasks'
    case 'needs_payment':    return 'Record payment'
    case 'needs_files':
      if (r.missingHandoffDocument) return 'Add handoff document'
      if (r.missingBrandAssets)     return 'Upload brand assets'
      return 'Add setup document'
    case 'needs_onboarding': return 'Complete onboarding tasks'
    case 'ready':            return 'Review and mark active'
  }
}

export function deriveLaunchState(
  client: ReadinessClient & { status?: string | null },
  files:  ReadinessFile[],
  tasks:  ReadinessTask[],
): LaunchDerived {
  const readiness = getClientHandoffReadiness(client, files, tasks)

  const hasHandoffDoc  = !readiness.missingHandoffDocument
  const hasBrandAssets = !readiness.missingBrandAssets
  const hasSetupDoc    = !readiness.missingSetupDocument
  const filesOk        = hasHandoffDoc && hasBrandAssets && hasSetupDoc

  const status         = client.status ?? ''
  const pay            = client.payment_status ?? null
  const paymentOk      = pay === 'paid' || pay === 'deposit_paid'
  const statusEligible = status === 'onboarding' || status === 'paused'

  const taskTotal = tasks.length
  const taskDone  = tasks.filter((t) => t.status === 'done').length

  let launchState: LaunchState
  if (status === 'active')      launchState = 'active'
  else if (status === 'archived') launchState = 'archived'
  else if (readiness.blockedTaskCount > 0 || readiness.overdueTaskCount > 0) launchState = 'blocked'
  else if (!paymentOk)          launchState = 'needs_payment'
  else if (!filesOk)            launchState = 'needs_files'
  else if (taskTotal === 0 || readiness.openTaskCount > 0) launchState = 'needs_onboarding'
  else                          launchState = statusEligible ? 'ready' : 'needs_onboarding'

  return {
    readiness,
    hasHandoffDoc, hasBrandAssets, hasSetupDoc,
    taskTotal, taskDone,
    taskOpen:    readiness.openTaskCount,
    taskBlocked: readiness.blockedTaskCount,
    taskOverdue: readiness.overdueTaskCount,
    launchState,
    nextAction:  launchNextAction(launchState, readiness),
  }
}
