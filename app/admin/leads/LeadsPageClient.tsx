'use client'

// Full leads page body — manages hidden-row state in localStorage so KPI
// cards and the Sales Focus panel always reflect only visible deals.
// Removal is UI-only: no backend call is made, no records are touched.

import { useState, useMemo, useEffect } from 'react'
import { Search, TrendingUp, RotateCcw } from 'lucide-react'
import type { MockPipelineDeal } from '@/lib/data/mock-team'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'

const LS_KEY = 'helios:admin:hidden-leads'

const STAGE_CONFIG: Record<MockPipelineDeal['stage'], { label: string; color: string }> = {
  new:        { label: 'New',        color: '#6a6a6e' },
  qualified:  { label: 'Qualified',  color: '#3b9eff' },
  audit_sent: { label: 'Audit Sent', color: '#ffae3c' },
  proposal:   { label: 'Proposal',   color: '#ff7a18' },
  won:        { label: 'Won',        color: '#22d093' },
  lost:       { label: 'Lost',       color: '#ff8a7a' },
}

const STAGE_OPTIONS = [
  { value: 'all',        label: 'All stages'  },
  { value: 'new',        label: 'New'         },
  { value: 'qualified',  label: 'Qualified'   },
  { value: 'audit_sent', label: 'Audit Sent'  },
  { value: 'proposal',   label: 'Proposal'    },
  { value: 'won',        label: 'Won'         },
  { value: 'lost',       label: 'Lost'        },
]

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  starter: { label: 'Starter',    color: '#3b9eff' },
  pro:     { label: 'Booking OS', color: '#a07cff' },
  scale:   { label: 'Ops Center', color: '#ffae3c' },
}

type RemoveModal = { open: false } | { open: true; ids: string[]; bulk: boolean }

interface Props { deals: MockPipelineDeal[] }

export default function LeadsPageClient({ deals }: Props) {
  const [hiddenIds,    setHiddenIds]    = useState<Set<string>>(new Set())
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [search,       setSearch]       = useState('')
  const [stageFilter,  setStageFilter]  = useState('all')
  const [removeModal,  setRemoveModal]  = useState<RemoveModal>({ open: false })

  // Load persisted hidden IDs after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) setHiddenIds(new Set(JSON.parse(stored) as string[]))
    } catch {}
  }, [])

  // Visible deals (not hidden) — drives KPIs and Sales Focus panel
  const visibleDeals = useMemo(
    () => deals.filter((d) => !hiddenIds.has(d.id)),
    [deals, hiddenIds],
  )

  // Filtered deals — drives table display only
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return visibleDeals.filter((d) => {
      if (stageFilter !== 'all' && d.stage !== stageFilter) return false
      if (!q) return true
      return (
        d.business.toLowerCase().includes(q)    ||
        d.contact.toLowerCase().includes(q)     ||
        d.next_action.toLowerCase().includes(q)
      )
    })
  }, [visibleDeals, search, stageFilter])

  // KPIs — always from visibleDeals (not affected by search filter)
  const total       = visibleDeals.length
  const qualified   = visibleDeals.filter((d) => ['qualified', 'audit_sent', 'proposal'].includes(d.stage)).length
  const proposals   = visibleDeals.filter((d) => d.stage === 'proposal').length
  const won         = visibleDeals.filter((d) => d.stage === 'won').length
  const pipelineVal = visibleDeals.filter((d) => d.stage !== 'lost').reduce((s, d) => s + d.value_usd, 0)
  const followUps   = visibleDeals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length

  const allSelected  = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id))
  const someSelected = filtered.some((d) => selectedIds.has(d.id))
  const selectedCount = [...selectedIds].filter((id) => filtered.some((d) => d.id === id)).length
  const pipelineValue = filtered.filter((d) => d.stage !== 'lost').reduce((s, d) => s + d.value_usd, 0)

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev); filtered.forEach((d) => next.delete(d.id)); return next
      })
    } else {
      setSelectedIds((prev) => new Set([...prev, ...filtered.map((d) => d.id)]))
    }
  }

  function hideIds(ids: string[]) {
    setHiddenIds((prev) => {
      const next = new Set([...prev, ...ids])
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
    setSelectedIds((prev) => {
      const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next
    })
  }

  function resetView() {
    setHiddenIds(new Set())
    setSelectedIds(new Set())
    try { localStorage.removeItem(LS_KEY) } catch {}
  }

  function confirmRemove() {
    if (!removeModal.open) return
    hideIds(removeModal.ids)
    setRemoveModal({ open: false })
  }

  const hasHidden = hiddenIds.size > 0

  return (
    <>
      {/* ── KPI Command Strip ─────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard label="Total Leads"     value={total}                          tone="neutral"                          sublabel="All stages"           />
        <AdminKpiCard label="Qualified"        value={qualified}                      tone="info"                             sublabel="Qualified → Proposal" />
        <AdminKpiCard label="Proposals Sent"   value={proposals}                      tone="warning"                          sublabel="Awaiting decision"    />
        <AdminKpiCard label="Won"              value={won}                            tone="success"                          sublabel="Closed clients"       />
        <AdminKpiCard label="Pipeline Value"   value={`$${pipelineVal.toLocaleString()}`} tone="orange"                      sublabel="Excl. lost deals"     />
        <AdminKpiCard label="Follow-Ups Due"   value={followUps}                      tone={followUps > 0 ? 'warning' : 'neutral'} sublabel="Active leads" />
      </section>

      {/* ── Pipeline table + Sales Focus ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Table */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Bulk action bar */}
          {someSelected && selectedCount > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl
                            border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
              <span className="text-[12.5px] text-[#ffae3c] font-medium tabular-nums">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={() => setRemoveModal({
                  open: true,
                  ids: filtered.filter((d) => selectedIds.has(d.id)).map((d) => d.id),
                  bulk: true,
                })}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg
                           bg-[#ff4d3a]/[0.12] border border-[#ff4d3a]/30 text-[#ff8a7a]
                           hover:bg-[#ff4d3a]/20 hover:text-white transition-all
                           focus:outline-none focus:ring-2 focus:ring-[#ff4d3a]/30"
              >
                Remove from view
              </button>
            </div>
          )}

          {/* Filter toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
              <input
                type="text"
                placeholder="Search business, contact, next action…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]
                           text-[13px] text-white placeholder-[#6a6a6e]
                           focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012]
                         text-[13px] text-white focus:outline-none focus:border-[#ff7a18]/40
                         transition-all cursor-pointer"
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06]
                            bg-white/[0.02] text-[12px] text-[#6a6a6e] shrink-0 whitespace-nowrap">
              <span className="text-[#22d093] font-semibold tabular-nums">
                ${pipelineValue.toLocaleString()}
              </span>
              <span>pipeline</span>
            </div>
          </div>

          {/* Table */}
          {deals.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12
                            text-center flex flex-col items-center gap-3">
              <div className="text-[15px] font-medium text-white">No leads yet</div>
              <p className="text-[13px] text-[#9a9a9d] max-w-[400px]">
                Leads will appear here after audit submissions are qualified or added to the pipeline.
              </p>
            </div>
          ) : visibleDeals.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10
                            text-center flex flex-col items-center gap-3 text-[13px] text-[#9a9a9d]">
              <p>No records visible.</p>
              {hasHidden && (
                <button
                  type="button"
                  onClick={resetView}
                  className="inline-flex items-center gap-1.5 text-[12px] text-[#ffae3c] hover:text-white transition-colors"
                >
                  <RotateCcw size={11} /> Reset view
                </button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10
                            text-center text-[13px] text-[#9a9a9d]">
              No leads match your search.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[760px]">
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
                      <th className="text-left px-4 py-2.5 min-w-[160px]">Business</th>
                      <th className="text-left px-4 py-2.5">Contact</th>
                      <th className="text-left px-4 py-2.5">Stage</th>
                      <th className="text-left px-4 py-2.5">Plan</th>
                      <th className="text-right px-4 py-2.5">Value</th>
                      <th className="text-left px-4 py-2.5">Next Action</th>
                      <th className="text-right px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const stage    = STAGE_CONFIG[d.stage]
                      const plan     = PLAN_CONFIG[d.plan_target] ?? { label: d.plan_target, color: '#6a6a6e' }
                      const selected = selectedIds.has(d.id)
                      return (
                        <tr
                          key={d.id}
                          className={`border-t border-white/[0.04] transition-colors
                            ${selected ? 'bg-[#ff7a18]/[0.04]' : 'hover:bg-white/[0.015]'}`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRow(d.id)}
                              aria-label={`Select ${d.business}`}
                              className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30"
                              style={{ accentColor: '#ff7a18', width: 13, height: 13 }}
                            />
                          </td>
                          <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{d.business}</td>
                          <td className="px-4 py-3 text-[#9a9a9d] whitespace-nowrap">{d.contact}</td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                              style={{ color: stage.color, borderColor: `${stage.color}33`, background: `${stage.color}12` }}
                            >
                              {stage.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                              style={{ color: plan.color, borderColor: `${plan.color}33`, background: `${plan.color}10` }}
                            >
                              {plan.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-white tabular-nums whitespace-nowrap">
                            ${d.value_usd.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-[#9a9a9d] max-w-[200px] truncate">{d.next_action}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setRemoveModal({ open: true, ids: [d.id], bulk: false })}
                              className="text-[11.5px] text-[#9a9a9d] hover:text-[#ff8a7a] transition-colors
                                         focus:outline-none focus:underline"
                              aria-label={`Remove ${d.business} from view`}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reset view footer */}
          {hasHidden && visibleDeals.length > 0 && (
            <div className="flex items-center justify-between text-[11.5px] text-[#6a6a6e] px-1">
              <span>{hiddenIds.size} record{hiddenIds.size !== 1 ? 's' : ''} hidden from view</span>
              <button
                type="button"
                onClick={resetView}
                className="inline-flex items-center gap-1 text-[#ffae3c]/70 hover:text-[#ffae3c] transition-colors"
              >
                <RotateCcw size={10} /> Reset view
              </button>
            </div>
          )}
        </div>

        {/* Sales Focus panel */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <TrendingUp size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Sales Focus</h2>
            </header>
            {visibleDeals.length === 0 ? (
              <div className="px-5 py-4 text-[12.5px] text-[#9a9a9d]">
                No active lead opportunities yet.
              </div>
            ) : (
              <div className="px-5 py-3.5 flex flex-col gap-3 text-[12.5px]">
                <PipelineRow stage="Qualified"  count={qualified} value={visibleDeals.filter((d) => d.stage === 'qualified').reduce((s, d) => s + d.value_usd, 0)}  color="#3b9eff" />
                <PipelineRow stage="Audit Sent" count={visibleDeals.filter((d) => d.stage === 'audit_sent').length} value={visibleDeals.filter((d) => d.stage === 'audit_sent').reduce((s, d) => s + d.value_usd, 0)} color="#ffae3c" />
                <PipelineRow stage="Proposal"   count={proposals} value={visibleDeals.filter((d) => d.stage === 'proposal').reduce((s, d) => s + d.value_usd, 0)}  color="#ff7a18" />
                <PipelineRow stage="Won"        count={won}       value={visibleDeals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value_usd, 0)}       color="#22d093" />
                <div className="border-t border-white/[0.06] pt-2.5 flex items-center justify-between">
                  <span className="text-[#9a9a9d]">Total pipeline value</span>
                  <span className="text-[#ffae3c] font-semibold tabular-nums">${pipelineVal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4">
            <p className="text-[13px] font-semibold text-white mb-2">Next best actions</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-[#9a9a9d]">
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Follow up on proposal-stage leads within 48 hours</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Move qualified audits to proposal stage</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Check new audit submissions for hot leads</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <ConfirmActionDialog
        open={removeModal.open}
        title={removeModal.open && removeModal.bulk ? 'Remove selected records?' : 'Remove this record?'}
        body={
          removeModal.open && removeModal.bulk
            ? 'This will remove the selected leads from the current view. No data is deleted — use Reset view to restore them.'
            : 'This will remove the lead from the current view. No data is deleted — use Reset view to restore it.'
        }
        confirmLabel={removeModal.open && removeModal.bulk ? 'Remove selected' : 'Remove record'}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveModal({ open: false })}
      />
    </>
  )
}

function PipelineRow({ stage, count, value, color }: { stage: string; count: number; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[#9a9a9d] flex-1">{stage}</span>
      <span className="tabular-nums font-medium text-white">{count}</span>
      {value > 0 && <span className="tabular-nums text-[11.5px] text-[#6a6a6e]">${value.toLocaleString()}</span>}
    </div>
  )
}
