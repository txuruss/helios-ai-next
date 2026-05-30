'use client'

import { useState, useMemo, useTransition } from 'react'
import { Search, SlidersHorizontal, ExternalLink } from 'lucide-react'
import type { AdminAuditRow } from '@/lib/data/admin-audits'
import StatusPill from '@/components/admin/ui/StatusPill'
import PriorityPill from '@/components/admin/ui/PriorityPill'
import PlanPill from '@/components/admin/ui/PlanPill'
import AuditActionsCell from './AuditActionsCell'
import AuditAiCell from './AuditAiCell'
import AuditAiResultModal from './AuditAiResultModal'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import { archiveBulkAuditSubmissions } from '@/lib/actions/admin-audits'
import type { AuditAiResult } from '@/lib/data/admin-audit-ai'

interface Props {
  rows:  AdminAuditRow[]
  total: number
  error: string | null
  aiResults:    Record<string, AuditAiResult>
  aiConfigured: boolean
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All statuses'  },
  { value: 'new',       label: 'New'           },
  { value: 'in_review', label: 'In Review'     },
  { value: 'qualified', label: 'Qualified'     },
  { value: 'contacted', label: 'Contacted'     },
  { value: 'converted', label: 'Converted'     },
  { value: 'archived',  label: 'Archived'      },
]

type ArchiveModal = { open: false } | { open: true; ids: string[]; bulk: boolean }

export default function AuditTableClient({ rows: initialRows, total, error, aiResults, aiConfigured }: Props) {
  const [localRows,    setLocalRows]    = useState(initialRows)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [archiveModal, setArchiveModal] = useState<ArchiveModal>({ open: false })
  const [isArchiving,  startArchive]    = useTransition()
  const [aiModal,      setAiModal]      = useState<{ result: AuditAiResult; name: string } | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return localRows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.business_name.toLowerCase().includes(q) ||
        (r.contact_name ?? '').toLowerCase().includes(q) ||
        (r.email        ?? '').toLowerCase().includes(q) ||
        (r.business_type ?? '').toLowerCase().includes(q) ||
        (r.city         ?? '').toLowerCase().includes(q)
      )
    })
  }, [localRows, search, statusFilter])

  const allSelected  = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))
  const someSelected = filtered.some((r) => selectedIds.has(r.id))
  const selectedCount = [...selectedIds].filter((id) => filtered.some((r) => r.id === id)).length

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds((prev) => new Set([...prev, ...filtered.map((r) => r.id)]))
    }
  }

  function requestArchive(ids: string[], bulk: boolean) {
    setArchiveModal({ open: true, ids, bulk })
  }

  function confirmArchive() {
    if (!archiveModal.open) return
    const ids = archiveModal.ids
    startArchive(async () => {
      const result = await archiveBulkAuditSubmissions(ids)
      if (result.ok) {
        const archived = new Set(ids)
        setLocalRows((prev) => prev.filter((r) => !archived.has(r.id)))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          ids.forEach((id) => next.delete(id))
          return next
        })
        setArchiveModal({ open: false })
      } else {
        alert(result.error ?? 'Could not archive records. Please try again.')
        setArchiveModal({ open: false })
      }
    })
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] p-6 text-[13.5px] text-[#ffae3c]">
        Intake table unavailable: {error}
      </div>
    )
  }

  if (initialRows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-12 text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          <SlidersHorizontal size={20} className="text-[#6a6a6e]" />
        </div>
        <div className="text-[15px] font-medium text-white">No audit submissions yet</div>
        <p className="text-[13px] text-[#9a9a9d] max-w-[400px]">
          When a prospect submits the public audit form, it will appear here.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">

        {/* Bulk action bar — only visible when rows are selected */}
        {someSelected && selectedCount > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl
                          border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
            <span className="text-[12.5px] text-[#ffae3c] font-medium tabular-nums">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={() => {
                const visibleSelected = filtered
                  .filter((r) => selectedIds.has(r.id))
                  .map((r) => r.id)
                requestArchive(visibleSelected, true)
              }}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg
                         bg-[#ff4d3a]/[0.12] border border-[#ff4d3a]/30 text-[#ff8a7a]
                         hover:bg-[#ff4d3a]/20 hover:text-white transition-all
                         focus:outline-none focus:ring-2 focus:ring-[#ff4d3a]/30"
            >
              Archive selected
            </button>
          </div>
        )}

        {/* Filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
            <input
              type="text"
              placeholder="Search business, contact, email, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]
                         text-[13px] text-white placeholder-[#6a6a6e]
                         focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04]
                         transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012]
                       text-[13px] text-white focus:outline-none focus:border-[#ff7a18]/40
                       transition-all cursor-pointer"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06]
                          bg-white/[0.02] text-[12px] text-[#6a6a6e] shrink-0">
            <span className="font-semibold text-white tabular-nums">{filtered.length}</span>
            <span>/ {localRows.length}</span>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10
                          text-center text-[13px] text-[#9a9a9d]">
            {localRows.length === 0
              ? 'No records visible. All submissions have been archived.'
              : 'No submissions match your search.'}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] min-w-[1180px]">
                <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                  <tr>
                    <th className="px-3 py-2.5 w-[36px]">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible rows"
                        className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30"
                        style={{ accentColor: '#ff7a18', width: 13, height: 13 }}
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 w-[180px]">Business</th>
                    <th className="text-left px-3 py-2.5">Industry</th>
                    <th className="text-left px-3 py-2.5">Location</th>
                    <th className="text-left px-3 py-2.5 max-w-[140px]">Website</th>
                    <th className="text-left px-3 py-2.5">Plan</th>
                    <th className="text-left px-3 py-2.5">Status</th>
                    <th className="text-left px-3 py-2.5">Priority</th>
                    <th className="text-right px-3 py-2.5">Score</th>
                    <th className="text-right px-3 py-2.5 whitespace-nowrap">Submitted</th>
                    <th className="text-left px-3 py-2.5">AI</th>
                    <th className="text-right px-3 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const location = row.location ?? (
                      [row.city, row.country].filter(Boolean).join(', ') || '—'
                    )
                    const isSelected = selectedIds.has(row.id)
                    return (
                      <tr
                        key={row.id}
                        className={`border-t border-white/[0.04] transition-colors
                          ${isSelected ? 'bg-[#ff7a18]/[0.04]' : 'hover:bg-white/[0.015]'}`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Select ${row.business_name}`}
                            className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30"
                            style={{ accentColor: '#ff7a18', width: 13, height: 13 }}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-white font-medium leading-snug">{row.business_name}</div>
                          {row.contact_name && (
                            <div className="text-[10.5px] text-[#6a6a6e] mt-0.5">
                              {row.contact_name}{row.email ? ` · ${row.email}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap">{row.business_type ?? '—'}</td>
                        <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap">{location}</td>
                        <td className="px-3 py-2.5 max-w-[140px]">
                          {row.website_url ? (
                            <a
                              href={row.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#9a9a9d] hover:text-[#ffae3c] transition-colors"
                            >
                              <span className="truncate max-w-[100px] block">
                                {row.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                              </span>
                              <ExternalLink size={9} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="text-[#6a6a6e]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5"><PlanPill plan={row.recommended_plan} /></td>
                        <td className="px-3 py-2.5"><StatusPill status={row.status} /></td>
                        <td className="px-3 py-2.5"><PriorityPill priority={row.priority} /></td>
                        <td className="px-3 py-2.5 text-right font-mono text-[12px]">
                          {row.qualification_score !== null ? (
                            <span className={
                              row.qualification_score >= 70 ? 'text-[#22d093]' :
                              row.qualification_score >= 40 ? 'text-[#ffae3c]' :
                              'text-[#ff8a7a]'
                            }>
                              {row.qualification_score}
                            </span>
                          ) : (
                            <span className="text-[#6a6a6e]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[11px] text-[#6a6a6e] whitespace-nowrap">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2.5">
                          <AuditAiCell
                            auditId={row.id}
                            result={aiResults[row.id]}
                            aiConfigured={aiConfigured}
                            onView={() => { const res = aiResults[row.id]; if (res) setAiModal({ result: res, name: row.business_name }) }}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <AuditActionsCell
                            submissionId={row.id}
                            status={row.status}
                            onArchiveRequest={(id) => requestArchive([id], false)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {total > initialRows.length && (
              <div className="px-4 py-2.5 border-t border-white/[0.04] text-[11px] text-[#6a6a6e] text-center">
                Showing {initialRows.length} of {total} submissions.
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmActionDialog
        open={archiveModal.open}
        title={archiveModal.open && archiveModal.bulk ? 'Archive selected records?' : 'Archive this record?'}
        body={
          archiveModal.open && archiveModal.bulk
            ? 'This will archive the selected audit submissions and remove them from the active queue. Records remain in the database with status "archived".'
            : 'This will archive the audit submission and remove it from the active queue. The record remains in the database with status "archived".'
        }
        confirmLabel={archiveModal.open && archiveModal.bulk ? 'Archive selected' : 'Archive record'}
        loading={isArchiving}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveModal({ open: false })}
      />

      {aiModal && (
        <AuditAiResultModal result={aiModal.result} businessName={aiModal.name} onClose={() => setAiModal(null)} />
      )}
    </>
  )
}
