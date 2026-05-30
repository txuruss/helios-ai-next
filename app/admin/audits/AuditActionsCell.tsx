'use client'

// Primary action buttons for an audit row, rendered inside the row's
// expandable action panel (ExpandableActionPanel). Replaces the old
// compact "⋯" menu so the founder sees the real actions laid out clearly.
//
// Each status action calls a server action in lib/actions/admin-audits.ts
// which re-derives founder identity (requireAdmin), updates
// audit_submissions.status, and revalidates /admin/audits +
// /admin/mission-control. Actions are gated by current status so no no-op
// is ever offered:
//   • new                    → Run/View AI · Mark reviewed · Qualify · Convert · Archive
//   • in_review              → Run/View AI · Qualify · Convert · Archive
//   • qualified / contacted  → Run/View AI · Convert · Archive
//   • converted              → Run/View AI · Archive
//   • archived               → Run/View AI only
//
// Run AI Audit / View AI Result are owned by the parent table (so the
// "Running" state shows in the Score / AI column and the AI modal opens at
// table level); they are passed in as callbacks. When Relevance AI is not
// connected, Run AI Audit is disabled but Qualify / Convert / Archive
// remain available.

import { useTransition } from 'react'
import {
  markAuditReviewed,
  qualifyAuditToLead,
  convertAuditToClient,
} from '@/lib/actions/admin-audits'
import type { AdminAuditStatus } from '@/lib/data/admin-audits'
import { PanelActionButton } from '@/components/admin/ui/ExpandableActionPanel'

interface Props {
  submissionId:     string
  status:           AdminAuditStatus
  aiConfigured:     boolean
  hasResult:        boolean
  completed:        boolean
  running:          boolean
  onRunAi:          () => void
  onView:           () => void
  onArchiveRequest: (id: string) => void
}

export default function AuditActionsCell({
  submissionId, status, aiConfigured, hasResult, completed, running, onRunAi, onView, onArchiveRequest,
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <PanelActionButton
          variant="primary"
          disabled={!aiConfigured || running}
          onClick={onRunAi}
          title={!aiConfigured ? 'Relevance AI not connected' : undefined}
        >
          {running ? 'Running…' : hasResult ? 'Re-run AI Audit' : 'Run AI Audit'}
        </PanelActionButton>

        {completed && (
          <PanelActionButton variant="info" onClick={onView}>View AI Result</PanelActionButton>
        )}
        {canMarkReviewed && (
          <PanelActionButton variant="secondary" disabled={pending} onClick={() => run(markAuditReviewed)}>
            Mark reviewed
          </PanelActionButton>
        )}
        {canQualify && (
          <PanelActionButton variant="info" disabled={pending} onClick={() => run(qualifyAuditToLead)}>
            Qualify
          </PanelActionButton>
        )}
        {canConvert && (
          <PanelActionButton variant="success" disabled={pending} onClick={() => run(convertAuditToClient)}>
            Convert
          </PanelActionButton>
        )}
        {canArchive && (
          <PanelActionButton variant="danger" disabled={pending} onClick={() => onArchiveRequest(submissionId)}>
            Archive
          </PanelActionButton>
        )}
      </div>

      {!aiConfigured && (
        <span className="text-[11px] text-[#6a6a6e]">
          Relevance AI not connected — Run AI Audit disabled. Qualify, Convert, and Archive still work.
        </span>
      )}
    </div>
  )
}
