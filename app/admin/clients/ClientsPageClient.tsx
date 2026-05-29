'use client'

// Clients CRM body — real data from public.admin_clients.
// MRR/ARR and KPIs are computed from REAL stored fees (monthly_fee),
// never a hardcoded plan map. Health is derived from the lead/booking
// snapshot and is never written to the database.
// Row actions call real server actions:
//   • Archive            → archiveClient        (soft, requires confirmation)
//   • Mark paused / etc. → updateClientStatus
// No record is ever hard-deleted; archiving sets status='archived'.

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Activity, X } from 'lucide-react'
import type { AdminClientRow, AdminClientStatus } from '@/lib/data/admin-clients'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import PlanPill from '@/components/admin/ui/PlanPill'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import { archiveClient, updateClientStatus } from '@/lib/actions/admin-clients'

type HealthStatus = 'Healthy' | 'Watch' | 'At Risk' | 'Unknown'

function computeHealth(leads: number, bookings: number): HealthStatus {
  if (leads === 0) return 'Unknown'
  const r = bookings / leads
  if (r >= 0.6) return 'Healthy'
  if (r >= 0.3) return 'Watch'
  return 'At Risk'
}

const HEALTH_COLORS: Record<HealthStatus, string> = {
  Healthy:   '#22d093',
  Watch:     '#ffae3c',
  'At Risk': '#ff8a7a',
  Unknown:   '#6a6a6e',
}

const STATUS_CONFIG: Record<AdminClientStatus, { label: string; color: string }> = {
  active:     { label: 'Active',     color: '#22d093' },
  onboarding: { label: 'Onboarding', color: '#3b9eff' },
  paused:     { label: 'Paused',     color: '#ffae3c' },
  churned:    { label: 'Churned',    color: '#ff8a7a' },
}

const PLAN_OPTIONS = [
  { value: 'all',     label: 'All plans'  },
  { value: 'starter', label: 'Starter'    },
  { value: 'pro',     label: 'Booking OS' },
  { value: 'scale',   label: 'Ops Center' },
]

const STATUS_OPTIONS = [
  { value: 'all',        label: 'All statuses' },
  { value: 'active',     label: 'Active'       },
  { value: 'onboarding', label: 'Onboarding'   },
  { value: 'paused',     label: 'Paused'       },
  { value: 'churned',    label: 'Churned'      },
]

type ActionModal =
  | { open: false }
  | { open: true; kind: 'archive' | 'pause' | 'activate'; id: string; name: string }

interface Props {
  clients: AdminClientRow[]
  error?: string | null
}

export default function ClientsPageClient({ clients, error }: Props) {
  const router = useRouter()
  const [search,       setSearch]       = useState('')
  const [planFilter,   setPlanFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal,        setModal]        = useState<ActionModal>({ open: false })
  const [details,      setDetails]      = useState<AdminClientRow | null>(null)
  const [isPending,    startTransition] = useTransition()
  const [actionError,  setActionError]  = useState<string | null>(null)

  // Filtered clients — drive table display only
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (planFilter   !== 'all' && c.plan   !== planFilter)   return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q)     ||
        c.industry.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      )
    })
  }, [clients, search, planFilter, statusFilter])

  // KPIs — from the full live (non-archived) set. MRR uses stored fees,
  // counting only currently-active recurring clients.
  const activeList  = clients.filter((c) => c.status === 'active')
  const active      = activeList.length
  const totalLeads  = clients.reduce((s, c) => s + c.monthly_leads,    0)
  const totalBook   = clients.reduce((s, c) => s + c.monthly_bookings, 0)
  const totalMRR    = activeList.reduce((s, c) => s + c.monthly_fee,   0)
  const avgMRR      = active > 0 ? Math.round(totalMRR / active) : 0
  const atRisk      = clients.filter((c) => computeHealth(c.monthly_leads, c.monthly_bookings) === 'At Risk').length

  function runAction() {
    if (!modal.open) return
    const { kind, id } = modal
    setActionError(null)
    startTransition(async () => {
      const result =
        kind === 'archive'  ? await archiveClient(id) :
        kind === 'pause'    ? await updateClientStatus(id, 'paused') :
                              await updateClientStatus(id, 'active')
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
        <AdminKpiCard label="Active Clients"   value={active}                          tone="neutral"                           sublabel="Status: active"       />
        <AdminKpiCard label="Monthly Leads"     value={totalLeads.toLocaleString()}     tone="info"                              sublabel="Across all clients"   />
        <AdminKpiCard label="Monthly Bookings"  value={totalBook.toLocaleString()}      tone="success"                           sublabel="Across all clients"   />
        <AdminKpiCard label="Estimated MRR"     value={`$${totalMRR.toLocaleString()}`} tone="orange"                            sublabel="Stripe not connected" />
        <AdminKpiCard label="Avg / Client"      value={`$${avgMRR}/mo`}                 tone="info"                              sublabel="MRR ÷ active clients" />
        <AdminKpiCard label="At-Risk Clients"   value={atRisk}                          tone={atRisk > 0 ? 'danger' : 'neutral'} sublabel={atRisk > 0 ? 'Low booking rate' : 'All healthy'} />
      </section>

      {error && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          {error}
        </div>
      )}

      {/* ── Client table + Health Focus ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Table */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Filter toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
              <input
                type="text"
                placeholder="Search business, industry, city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]
                           text-[13px] text-white placeholder-[#6a6a6e]
                           focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all"
              />
            </div>
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
          </div>

          {/* Table */}
          {clients.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12
                            text-center flex flex-col items-center gap-3">
              <div className="text-[15px] font-medium text-white">No active clients yet</div>
              <p className="text-[13px] text-[#9a9a9d] max-w-[420px]">
                No active clients yet. Converted clients will appear here after onboarding begins.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10
                            text-center text-[13px] text-[#9a9a9d]">
              No clients match your search.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[980px]">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                    <tr>
                      <th className="text-left px-4 py-2.5 min-w-[150px]">Business</th>
                      <th className="text-left px-4 py-2.5">Industry</th>
                      <th className="text-left px-4 py-2.5">Plan</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                      <th className="text-right px-4 py-2.5 whitespace-nowrap">Leads/mo</th>
                      <th className="text-right px-4 py-2.5 whitespace-nowrap">Bookings/mo</th>
                      <th className="text-right px-4 py-2.5 whitespace-nowrap">Est. MRR</th>
                      <th className="text-left px-4 py-2.5">Health</th>
                      <th className="text-right px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const health      = computeHealth(c.monthly_leads, c.monthly_bookings)
                      const healthColor = HEALTH_COLORS[health]
                      const statusCfg   = STATUS_CONFIG[c.status]
                      return (
                        <tr key={c.id} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.015]">
                          <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{c.name}</td>
                          <td className="px-4 py-3 text-[#9a9a9d] whitespace-nowrap">{c.industry}</td>
                          <td className="px-4 py-3"><PlanPill plan={c.plan} /></td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                              style={{ color: statusCfg.color, borderColor: `${statusCfg.color}33`, background: `${statusCfg.color}12` }}
                            >
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-white tabular-nums">{c.monthly_leads}</td>
                          <td className="px-4 py-3 text-right font-mono text-white tabular-nums">{c.monthly_bookings}</td>
                          <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-white tabular-nums">
                            ${c.monthly_fee.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                              style={{ color: healthColor, borderColor: `${healthColor}33`, background: `${healthColor}12` }}
                            >
                              {health}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-3 text-[11.5px] whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setDetails(c)}
                                className="text-[#9a9a9d] hover:text-white transition-colors focus:outline-none focus:underline"
                              >
                                View
                              </button>
                              {c.status === 'paused' ? (
                                <button
                                  type="button"
                                  onClick={() => setModal({ open: true, kind: 'activate', id: c.id, name: c.name })}
                                  className="text-[#22d093] hover:text-[#5be4b5] transition-colors focus:outline-none focus:underline"
                                >
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setModal({ open: true, kind: 'pause', id: c.id, name: c.name })}
                                  className="text-[#ffae3c] hover:text-[#ffce7a] transition-colors focus:outline-none focus:underline"
                                >
                                  Pause
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setModal({ open: true, kind: 'archive', id: c.id, name: c.name })}
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

        {/* Client Health Focus panel */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <Activity size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Client Health</h2>
            </header>
            {clients.length === 0 ? (
              <div className="px-5 py-4 text-[12.5px] text-[#9a9a9d]">
                No client health data yet.
              </div>
            ) : (
              <div className="px-5 py-3.5 flex flex-col gap-3 text-[12.5px]">
                <HealthRow label="Healthy" count={clients.filter((c) => computeHealth(c.monthly_leads, c.monthly_bookings) === 'Healthy').length} color="#22d093" note="Booking rate ≥ 60%" />
                <HealthRow label="Watch"   count={clients.filter((c) => computeHealth(c.monthly_leads, c.monthly_bookings) === 'Watch').length}   color="#ffae3c" note="Booking rate 30–59%" />
                <HealthRow label="At Risk" count={atRisk} color="#ff8a7a" note="Booking rate < 30%" />
                <div className="border-t border-white/[0.06] pt-2.5 flex items-center justify-between">
                  <span className="text-[#9a9a9d]">Active clients</span>
                  <span className="text-[#ffae3c] font-semibold tabular-nums">{active}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4 text-[12px] text-[#9a9a9d]">
            <p className="font-semibold text-white mb-2 text-[13px]">Health legend</p>
            <div className="flex flex-col gap-1.5">
              <LegendRow color="#22d093" label="Healthy — booking rate ≥ 60%" />
              <LegendRow color="#ffae3c" label="Watch — booking rate 30–59%" />
              <LegendRow color="#ff8a7a" label="At Risk — booking rate < 30%" />
              <LegendRow color="#6a6a6e" label="Unknown — no lead data" />
            </div>
            <p className="text-[10.5px] text-[#6a6a6e] mt-3 border-t border-white/[0.06] pt-2.5">
              Health is calculated from lead/booking ratios only. Not written to the database.
            </p>
          </section>
        </aside>
      </div>

      {/* Confirmation dialog */}
      <ConfirmActionDialog
        open={modal.open}
        title={
          !modal.open ? '' :
          modal.kind === 'archive'  ? 'Archive this client?' :
          modal.kind === 'pause'    ? 'Pause this client?'   :
                                      'Reactivate this client?'
        }
        body={
          !modal.open ? '' :
          modal.kind === 'archive'
            ? `This archives "${modal.name}" and removes it from the active list. No data is deleted — the record stays in the database with status "archived".${actionError ? `\n\n${actionError}` : ''}`
            : modal.kind === 'pause'
              ? `This marks "${modal.name}" as paused. It will no longer count toward active MRR until reactivated.${actionError ? `\n\n${actionError}` : ''}`
              : `This marks "${modal.name}" as active again and includes it in MRR.${actionError ? `\n\n${actionError}` : ''}`
        }
        confirmLabel={
          !modal.open ? '' :
          modal.kind === 'archive'  ? 'Archive client' :
          modal.kind === 'pause'    ? 'Pause client'   :
                                      'Reactivate'
        }
        loading={isPending}
        onConfirm={runAction}
        onCancel={() => { setModal({ open: false }); setActionError(null) }}
      />

      {/* Read-only details modal */}
      {details && <ClientDetails client={details} onClose={() => setDetails(null)} />}
    </>
  )
}

function HealthRow({ label, count, color, note }: { label: string; count: number; color: string; note: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[#9a9a9d] flex-1">{label}</span>
      <span className="tabular-nums font-semibold text-white">{count}</span>
      <span className="text-[10.5px] text-[#6a6a6e] shrink-0 hidden sm:block">{note}</span>
    </div>
  )
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[11px] text-[#9a9a9d]">{label}</span>
    </div>
  )
}

function ClientDetails({ client, onClose }: { client: AdminClientRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <h2 className="text-[15px] font-semibold text-white leading-snug">{client.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors shrink-0 mt-0.5">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 pb-5 flex flex-col gap-2 text-[13px]">
          <DetailRow label="Industry"      value={client.industry} />
          <DetailRow label="City"          value={client.city} />
          <DetailRow label="Plan"          value={client.plan || '—'} />
          <DetailRow label="Status"        value={STATUS_CONFIG[client.status].label} />
          <DetailRow label="Setup fee"     value={`$${client.setup_fee.toLocaleString()}`} />
          <DetailRow label="Monthly fee"   value={`$${client.monthly_fee.toLocaleString()}/mo`} />
          <DetailRow label="Leads / mo"    value={String(client.monthly_leads)} />
          <DetailRow label="Bookings / mo" value={String(client.monthly_bookings)} />
          <DetailRow label="Client since"  value={new Date(client.created_at).toLocaleDateString()} />
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
