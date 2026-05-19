'use client'

// Per-row action buttons for the /admin/audits table. Each button calls
// a server action in lib/actions/admin-audits.ts which:
//   1. re-derives founder identity server-side (requireAdmin)
//   2. updates audit_submissions.status
//   3. revalidates /admin/audits + /admin/mission-control
//
// The visible button set is gated by the submission's current status
// so the founder is never offered an action that's a no-op:
//   • new                          → Mark reviewed · Convert · Archive
//   • in_review / qualified /
//     contacted                    → Convert · Archive
//   • converted                    → Archive
//   • archived                     → (no actions)

import { useTransition } from 'react'
import {
  markAuditReviewed,
  archiveAuditSubmission,
  convertAuditSubmission,
} from '@/lib/actions/admin-audits'
import type { AdminAuditStatus } from '@/lib/data/admin-audits'

interface Props {
  submissionId: string
  status:       AdminAuditStatus
}

export default function AuditActionsCell({ submissionId, status }: Props) {
  const [pending, startTransition] = useTransition()

  const canMarkReviewed = status === 'new'
  const canConvert      = status !== 'converted' && status !== 'archived'
  const canArchive      = status !== 'archived'

  function run(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn(submissionId)
      if (!result.ok) {
        // Surfaced as a native alert so we don't depend on a toast
        // library in this lean pass. Replace with a toast when one
        // lands in components/ui.
        alert(result.error ?? 'Action failed. Try again.')
      }
    })
  }

  return (
    <div className="flex justify-end gap-3 text-[11.5px]">
      {canMarkReviewed && (
        <ActionButton disabled={pending} onClick={() => run(markAuditReviewed)} tone="info">
          Mark reviewed
        </ActionButton>
      )}
      {canConvert && (
        <ActionButton disabled={pending} onClick={() => run(convertAuditSubmission)} tone="success">
          Convert
        </ActionButton>
      )}
      {canArchive && (
        <ActionButton disabled={pending} onClick={() => run(archiveAuditSubmission)} tone="muted">
          Archive
        </ActionButton>
      )}
      {!canMarkReviewed && !canConvert && !canArchive && (
        <span className="text-[#6a6a6e]">No actions</span>
      )}
    </div>
  )
}

const TONE: Record<'info' | 'success' | 'muted', string> = {
  info:    'text-[#3b9eff] hover:text-[#7ec0ff]',
  success: 'text-[#22d093] hover:text-[#5be4b5]',
  muted:   'text-[#9a9a9d] hover:text-white',
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode
  onClick:  () => void
  disabled: boolean
  tone:     keyof typeof TONE
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${TONE[tone]} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}
