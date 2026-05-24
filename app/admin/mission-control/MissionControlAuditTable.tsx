'use client'

// Compact audit submissions table for Mission Control.
// Manages its own row state for optimistic archive updates.
// Full archive/bulk actions are on /admin/audits — this view is read + single-row archive only.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import type { AdminAuditRow } from '@/lib/data/admin-audits'
import StatusPill from '@/components/admin/ui/StatusPill'
import PlanPill from '@/components/admin/ui/PlanPill'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import { archiveAuditSubmission } from '@/lib/actions/admin-audits'

interface Props {
  rows: AdminAuditRow[]
}

type ArchiveModal = { open: false } | { open: true; id: string; name: string }

export default function MissionControlAuditTable({ rows: initialRows }: Props) {
  const [rows,         setRows]         = useState(initialRows)
  const [archiveModal, setArchiveModal] = useState<ArchiveModal>({ open: false })
  const [isPending,    startTransition] = useTransition()

  function confirmArchive() {
    if (!archiveModal.open) return
    const id = archiveModal.id
    startTransition(async () => {
      const result = await archiveAuditSubmission(id)
      if (result.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id))
        setArchiveModal({ open: false })
      } else {
        alert(result.error ?? 'Could not archive record. Please try again.')
        setArchiveModal({ open: false })
      }
    })
  }

  if (rows.length === 0) {
    return (
      <>
        <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
          <FileText size={24} className="text-[#3a3a3e]" />
          <p className="text-[13px] text-white">No audit submissions yet</p>
          <p className="text-[12px] text-[#9a9a9d]">
            New intake from{' '}
            <Link href="/audit" className="text-[#ffae3c] hover:underline">/audit</Link>
            {' '}and{' '}
            <Link href="/register-business" className="text-[#ffae3c] hover:underline">/register-business</Link>
            {' '}will appear here.
          </p>
        </div>
        <ConfirmActionDialog
          open={archiveModal.open}
          title="Archive this submission?"
          body="This will archive the audit submission and remove it from the active queue. The record remains in the database."
          confirmLabel="Archive"
          loading={isPending}
          onConfirm={confirmArchive}
          onCancel={() => setArchiveModal({ open: false })}
        />
      </>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[640px]">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-4 py-2.5">Business</th>
              <th className="text-left px-4 py-2.5">Industry</th>
              <th className="text-left px-4 py-2.5">Plan</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Score</th>
              <th className="text-right px-4 py-2.5">Submitted</th>
              <th className="text-right px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                <td className="px-4 py-2.5">
                  <div className="text-white font-medium">{a.business_name}</div>
                  {a.contact_name && (
                    <div className="text-[10.5px] text-[#6a6a6e] mt-0.5">{a.contact_name}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#9a9a9d] whitespace-nowrap">{a.business_type ?? '—'}</td>
                <td className="px-4 py-2.5"><PlanPill plan={a.recommended_plan} /></td>
                <td className="px-4 py-2.5"><StatusPill status={a.status} /></td>
                <td className="px-4 py-2.5 text-right font-mono text-[11.5px]">
                  {a.qualification_score !== null ? (
                    <span className={
                      a.qualification_score >= 70 ? 'text-[#22d093]' :
                      a.qualification_score >= 40 ? 'text-[#ffae3c]' :
                      'text-[#ff8a7a]'
                    }>
                      {a.qualification_score}
                    </span>
                  ) : (
                    <span className="text-[#6a6a6e]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-[11px] text-[#6a6a6e] whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {a.status !== 'archived' ? (
                    <button
                      type="button"
                      onClick={() => setArchiveModal({ open: true, id: a.id, name: a.business_name })}
                      disabled={isPending}
                      className="text-[11.5px] text-[#9a9a9d] hover:text-[#ff8a7a] transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 focus:outline-none focus:underline"
                      aria-label={`Archive ${a.business_name}`}
                    >
                      Archive
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#6a6a6e]">Archived</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmActionDialog
        open={archiveModal.open}
        title="Archive this submission?"
        body="This will archive the audit submission and remove it from the active queue. The record remains in the database."
        confirmLabel="Archive"
        loading={isPending}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveModal({ open: false })}
      />
    </>
  )
}
