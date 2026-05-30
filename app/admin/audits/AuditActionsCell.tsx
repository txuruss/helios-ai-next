'use client'

// Per-row action menu for the /admin/audits table. Collapses every row
// action into a single compact "⋯" menu (RowActionMenu) so the Actions
// column stays narrow and visible without horizontal scroll.
//
// Each action calls a server action in lib/actions/admin-audits.ts which:
//   1. re-derives founder identity server-side (requireAdmin)
//   2. updates audit_submissions.status
//   3. revalidates /admin/audits + /admin/mission-control
//
// The available actions are gated by the submission's current status so
// the founder is never offered a no-op:
//   • new                    → Run/View AI · Mark reviewed · Qualify · Convert · Archive
//   • in_review              → Run/View AI · Qualify · Convert · Archive
//   • qualified / contacted  → Run/View AI · Convert · Archive
//   • converted              → Run/View AI · Archive
//   • archived               → Run/View AI only
//
// Run AI Audit / View AI Result are owned by the parent table (so the
// "Running" state can show in the Score / AI column); they are passed in
// as callbacks. Qualify creates an admin_leads row; Convert creates an
// admin_clients row; Archive routes through the parent confirm dialog.

import { useTransition } from 'react'
import {
  markAuditReviewed,
  qualifyAuditToLead,
  convertAuditToClient,
} from '@/lib/actions/admin-audits'
import type { AdminAuditStatus } from '@/lib/data/admin-audits'
import RowActionMenu, { type RowAction } from '@/components/admin/ui/RowActionMenu'

interface Props {
  submissionId:     string
  status:           AdminAuditStatus
  aiConfigured:     boolean
  hasResult:        boolean
  onRunAi:          () => void
  onView:           () => void
  onArchiveRequest: (id: string) => void
}

export default function AuditActionsCell({
  submissionId, status, aiConfigured, hasResult, onRunAi, onView, onArchiveRequest,
}: Props) {
  const [pending, startTransition] = useTransition()

  const canMarkReviewed = status === 'new'
  const canQualify      = status === 'new' || status === 'in_review'
  const canConvert      = status !== 'converted' && status !== 'archived'
  const canArchive      = status !== 'archived'

  function run(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn(submissionId)
      if (!result.ok) alert(result.error ?? 'Action failed. Try again.')
    })
  }

  const actions: RowAction[] = []
  if (aiConfigured) actions.push({ label: hasResult ? 'Re-run AI audit' : 'Run AI audit', onSelect: onRunAi })
  if (hasResult)    actions.push({ label: 'View AI result', tone: 'info', onSelect: onView })
  if (canMarkReviewed) actions.push({ label: 'Mark reviewed', tone: 'info', onSelect: () => run(markAuditReviewed) })
  if (canQualify)      actions.push({ label: 'Qualify → lead', tone: 'info', onSelect: () => run(qualifyAuditToLead) })
  if (canConvert)      actions.push({ label: 'Convert → client', tone: 'success', onSelect: () => run(convertAuditToClient) })
  if (canArchive)      actions.push({ label: 'Archive', tone: 'danger', onSelect: () => onArchiveRequest(submissionId) })

  return (
    <div className="flex justify-end">
      <RowActionMenu actions={actions} busy={pending} label="Audit actions" />
    </div>
  )
}
