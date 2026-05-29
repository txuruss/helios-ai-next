'use client'

// Leads pipeline body — real data from public.admin_leads.
// KPIs + Sales Focus reflect the live (non-archived) lead set.
// Row actions call real server actions:
//   • Convert to client → convertLeadToClient  (requires confirmation)
//   • Archive           → archiveLead           (soft, requires confirmation)
// No record is ever hard-deleted; archiving sets stage='archived'.

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp, X } from 'lucide-react'
import type { AdminLeadRow, AdminLeadStage } from '@/lib/data/admin-leads'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import { convertLeadToClient, archiveLead } from '@/lib/actions/admin-leads'

const STAGE_CONFIG: Record<AdminLeadStage, { label: string; color: string }> = {
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

const PLAN_OPTIONS = [
  { value: 'all',     label: 'All plans'  },
  { value: 'starter', label: 'Starter'    },
  { value: 'pro',     label: 'Booking OS' },
  { value: 'scale',   label: 'Ops Center' },
]

type ActionModal =
  | { open: false }
  | { open: true; kind: 'archive' | 'convert'; id: string; name: string }

interface Props {
  leads: AdminLeadRow[]
  error?: string | null
}

export default function LeadsPageClient({ leads, error }: Props) {
  const router = useRouter()
  const [search,      setSearch]      = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [planFilter,  setPlanFilter]  = useState('all')
  const [modal,       setModal]       = useState<ActionModal>({ open: false })
  const [details,     setDetails]     = useState<AdminLeadRow | null>(null)
  const [isPending,   startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  // Filtered leads — drive table display only
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((d) => {
      if (stageFilter !== 'all' && d.stage !== stageFilter) return false
      if (planFilter  !== 'all' && d.plan_target !== planFilter) return false
      if (!q) return true
      return (
        d.business.toLowerCase().includes(q) ||
        d.contact.toLowerCase().includes(q)  ||
        (d.email ?? '').toLowerCase().includes(q) ||
        d.next_action.toLowerCase().includes(q)
      )
    })
  }, [leads, search, stageFilter, planFilter])

  // KPIs — from the full live lead set (archived already excluded server-side)
  const total       = leads.length
  const qualified   = leads.filter((d) => ['qualified', 'audit_sent', 'proposal'].includes(d.stage)).length
  const proposals   = leads.filter((d) => d.stage === 'proposal').length
  const won         = leads.filter((d) => d.stage === 'won').length
  const pipelineVal = leads.filter((d) => d.stage !== 'lost').reduce((s, d) => s + d.value_usd, 0)
  const followUps   = leads.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length

  function runAction() {
    if (!modal.open) return
    const { kind, id } = modal
    setActionError(null)
    startTransition(async () => {
      const result = kind === 'convert'
        ? await convertLeadToClient(id)
        : await archiveLead(id)
      if (result.ok) {
        setModal({ open: false })
        router.refresh()
      } else {
        setActionError(result.error ?? 'Action failed. Please try again.')
      }
    })
  }

  return (
    <>
      {/* ── KPI Command Strip ─────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard label="Total Leads"    value={total}                              tone="neutral"                               sublabel="All stages"           />
        <AdminKpiCard label="Qualified"       value={qualified}                          tone="info"                                  sublabel="Qualified → Proposal" />
        <AdminKpiCard label="Proposals Sent"  value={proposals}                          tone="warning"                               sublabel="Awaiting decision"    />
        <AdminKpiCard label="Won"             value={won}                                tone="success"                               sublabel="Closed clients"       />
        <AdminKpiCard label="Pipeline Value"  value={`$${pipelineVal.toLocaleString()}`} tone="orange"                                sublabel="Excl. lost deals"     />
        <AdminKpiCard label="Follow-Ups Due"  value={followUps}                          tone={followUps > 0 ? 'warning' : 'neutral'} sublabel="Active leads"         />
      </section>

      {error && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          {error}
        </div>
      )}

      {/* ── Pipeline table + Sales Focus ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Table */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Filter toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
              <input
                type="text"
                placeholder="Search business, contact, email…"
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
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012]
                         text-[13px] text-white focus:outline-none focus:border-[#ff7a18]/40
                         transition-all cursor-pointer"
            >
              {PLAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {leads.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12
                            text-center flex flex-col items-center gap-3">
              <div className="text-[15px] font-medium text-white">No leads yet</div>
              <p className="text-[13px] text-[#9a9a9d] max-w-[420px]">
                No leads yet. Qualified opportunities will appear here after audits are reviewed.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10
                            text-center text-[13px] text-[#9a9a9d]">
              No leads match your search.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[820px]">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                    <tr>
                      <th className="text-left px-4 py-2.5 min-w-[160px]">Business</th>
                      <th className="text-left px-4 py-2.5">Contact</th>
                      <th className="text-left px-4 py-2.5">Stage</th>
                      <th className="text-left px-4 py-2.5">Plan</th>
                      <th className="text-right px-4 py-2.5">Value</th>
                      <th className="text-left px-4 py-2.5">Next Action</th>
                      <th className="text-right px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const stage = STAGE_CONFIG[d.stage]
                      const plan  = PLAN_CONFIG[d.plan_target] ?? { label: d.plan_target || '—', color: '#6a6a6e' }
                      return (
                        <tr key={d.id} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.015]">
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
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-3 text-[11.5px] whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setDetails(d)}
                                className="text-[#9a9a9d] hover:text-white transition-colors focus:outline-none focus:underline"
                              >
                                View
                              </button>
                              {d.stage !== 'won' && (
                                <button
                                  type="button"
                                  onClick={() => setModal({ open: true, kind: 'convert', id: d.id, name: d.business })}
                                  className="text-[#22d093] hover:text-[#5be4b5] transition-colors focus:outline-none focus:underline"
                                >
                                  Convert
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setModal({ open: true, kind: 'archive', id: d.id, name: d.business })}
                                className="text-[#9a9a9d] hover:text-[#ff8a7a] transition-colors focus:outline-none focus:underline"
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
            {leads.length === 0 ? (
              <div className="px-5 py-4 text-[12.5px] text-[#9a9a9d]">
                No active lead opportunities yet.
              </div>
            ) : (
              <div className="px-5 py-3.5 flex flex-col gap-3 text-[12.5px]">
                <PipelineRow stage="Qualified"  count={leads.filter((d) => d.stage === 'qualified').length}  value={leads.filter((d) => d.stage === 'qualified').reduce((s, d) => s + d.value_usd, 0)}  color="#3b9eff" />
                <PipelineRow stage="Audit Sent" count={leads.filter((d) => d.stage === 'audit_sent').length} value={leads.filter((d) => d.stage === 'audit_sent').reduce((s, d) => s + d.value_usd, 0)} color="#ffae3c" />
                <PipelineRow stage="Proposal"   count={proposals}                                            value={leads.filter((d) => d.stage === 'proposal').reduce((s, d) => s + d.value_usd, 0)}   color="#ff7a18" />
                <PipelineRow stage="Won"        count={won}                                                  value={leads.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value_usd, 0)}        color="#22d093" />
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
                <span>Convert won leads into onboarding clients</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Check new audit submissions for hot leads</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      {/* Confirmation dialog (Convert / Archive) */}
      <ConfirmActionDialog
        open={modal.open}
        title={
          modal.open && modal.kind === 'convert'
            ? 'Convert lead to client?'
            : 'Archive this lead?'
        }
        body={
          modal.open && modal.kind === 'convert'
            ? `This creates a client record for "${modal.name}" (onboarding) with fees defaulted from its plan, and marks the lead as Won. You can edit fees on the client.${actionError ? `\n\n${actionError}` : ''}`
            : modal.open
              ? `This archives the lead for "${modal.name}". No data is deleted — the record stays in the database with stage "archived".${actionError ? `\n\n${actionError}` : ''}`
              : ''
        }
        confirmLabel={modal.open && modal.kind === 'convert' ? 'Convert to client' : 'Archive lead'}
        loading={isPending}
        onConfirm={runAction}
        onCancel={() => { setModal({ open: false }); setActionError(null) }}
      />

      {/* Read-only details modal */}
      {details && <LeadDetails lead={details} onClose={() => setDetails(null)} />}
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

function LeadDetails({ lead, onClose }: { lead: AdminLeadRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <h2 className="text-[15px] font-semibold text-white leading-snug">{lead.business}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors shrink-0 mt-0.5">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 pb-5 flex flex-col gap-2 text-[13px]">
          <DetailRow label="Contact"     value={lead.contact} />
          <DetailRow label="Email"       value={lead.email ?? '—'} />
          <DetailRow label="Stage"       value={STAGE_CONFIG[lead.stage].label} />
          <DetailRow label="Target plan" value={(PLAN_CONFIG[lead.plan_target]?.label) ?? (lead.plan_target || '—')} />
          <DetailRow label="Est. value"  value={`$${lead.value_usd.toLocaleString()}`} />
          <DetailRow label="Next action" value={lead.next_action} />
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#6a6a6e]">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  )
}
