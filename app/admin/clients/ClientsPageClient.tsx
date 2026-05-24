'use client'

// Full clients page body — manages hidden-row state in localStorage so KPI
// cards and the Client Health panel always reflect only visible clients.
// Removal is UI-only: no backend call is made, no records are touched.
// Health calculation stays UI-only and is never written to the database.

import { useState, useMemo, useEffect } from 'react'
import { Search, Activity, RotateCcw } from 'lucide-react'
import type { MockBusiness } from '@/lib/data/mock-businesses'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import PlanPill from '@/components/admin/ui/PlanPill'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'

const LS_KEY = 'helios:admin:hidden-clients'

const PLAN_RATES: Record<string, number> = { starter: 149, pro: 399, scale: 999, free: 0 }

type HealthStatus = 'Healthy' | 'Watch' | 'At Risk' | 'Unknown'

function computeHealth(leads: number, bookings: number): HealthStatus {
  if (leads === 0) return 'Unknown'
  const r = bookings / leads
  if (r >= 0.6) return 'Healthy'
  if (r >= 0.3) return 'Watch'
  return 'At Risk'
}

// For parent page server-side calculations (returns lowercase keys)
function clientHealth(leads: number, bookings: number): 'healthy' | 'watch' | 'at_risk' | 'unknown' {
  if (leads === 0) return 'unknown'
  const r = bookings / leads
  if (r >= 0.6) return 'healthy'
  if (r >= 0.3) return 'watch'
  return 'at_risk'
}

const HEALTH_COLORS: Record<HealthStatus, string> = {
  Healthy:   '#22d093',
  Watch:     '#ffae3c',
  'At Risk': '#ff8a7a',
  Unknown:   '#6a6a6e',
}

const PLAN_OPTIONS = [
  { value: 'all',     label: 'All plans'  },
  { value: 'starter', label: 'Starter'    },
  { value: 'pro',     label: 'Booking OS' },
  { value: 'scale',   label: 'Ops Center' },
]

type RemoveModal = { open: false } | { open: true; ids: string[]; bulk: boolean }

interface Props { clients: MockBusiness[] }

export default function ClientsPageClient({ clients }: Props) {
  const [hiddenIds,    setHiddenIds]    = useState<Set<string>>(new Set())
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [search,       setSearch]       = useState('')
  const [planFilter,   setPlanFilter]   = useState('all')
  const [removeModal,  setRemoveModal]  = useState<RemoveModal>({ open: false })

  // Load persisted hidden IDs after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) setHiddenIds(new Set(JSON.parse(stored) as string[]))
    } catch {}
  }, [])

  // Visible clients (not hidden) — drives KPIs and health panel
  const visibleClients = useMemo(
    () => clients.filter((c) => !hiddenIds.has(c.id)),
    [clients, hiddenIds],
  )

  // Filtered clients — drives table display only
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return visibleClients.filter((c) => {
      if (planFilter !== 'all' && c.plan !== planFilter) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q)     ||
        c.industry.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      )
    })
  }, [visibleClients, search, planFilter])

  // KPIs — always from visibleClients (not affected by search filter)
  const active     = visibleClients.length
  const totalLeads = visibleClients.reduce((s, c) => s + c.monthly_leads,    0)
  const totalBook  = visibleClients.reduce((s, c) => s + c.monthly_bookings, 0)
  const totalMRR   = visibleClients.reduce((s, c) => s + (PLAN_RATES[c.plan] ?? 0), 0)
  const avgMRR     = active > 0 ? Math.round(totalMRR / active) : 0
  const atRisk     = visibleClients.filter((c) => clientHealth(c.monthly_leads, c.monthly_bookings) === 'at_risk').length

  const allSelected   = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id))
  const someSelected  = filtered.some((c) => selectedIds.has(c.id))
  const selectedCount = [...selectedIds].filter((id) => filtered.some((c) => c.id === id)).length
  const hasHidden     = hiddenIds.size > 0

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev); filtered.forEach((c) => next.delete(c.id)); return next
      })
    } else {
      setSelectedIds((prev) => new Set([...prev, ...filtered.map((c) => c.id)]))
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

  return (
    <>
      {/* ── KPI Command Strip ─────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard label="Active Clients"   value={active}                            tone="neutral"                          sublabel="All plans"             />
        <AdminKpiCard label="Monthly Leads"     value={totalLeads.toLocaleString()}       tone="info"                             sublabel="Across all clients"    />
        <AdminKpiCard label="Monthly Bookings"  value={totalBook.toLocaleString()}        tone="success"                          sublabel="Across all clients"    />
        <AdminKpiCard label="Estimated MRR"     value={`$${totalMRR.toLocaleString()}`}   tone="orange"                           sublabel="Stripe not connected"  />
        <AdminKpiCard label="Avg / Client"      value={`$${avgMRR}/mo`}                   tone="info"                             sublabel="MRR ÷ active clients"  />
        <AdminKpiCard label="At-Risk Clients"   value={atRisk}                            tone={atRisk > 0 ? 'danger' : 'neutral'} sublabel={atRisk > 0 ? 'Low booking rate' : 'All healthy'} />
      </section>

      {/* ── Client table + Health Focus ───────────────────────────── */}
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
                  ids: filtered.filter((c) => selectedIds.has(c.id)).map((c) => c.id),
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
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.06]
                            bg-white/[0.02] text-[12px] text-[#6a6a6e] shrink-0">
              <span className="font-semibold text-white tabular-nums">{filtered.length}</span>
              <span>/ {visibleClients.length}</span>
            </div>
          </div>

          {/* Table */}
          {clients.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12
                            text-center flex flex-col items-center gap-3">
              <div className="text-[15px] font-medium text-white">No active clients yet</div>
              <p className="text-[13px] text-[#9a9a9d] max-w-[400px]">
                Clients will appear here after an audit is converted into an active account.
              </p>
            </div>
          ) : visibleClients.length === 0 ? (
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
              No clients match your search.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[920px]">
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
                      <th className="text-left px-4 py-2.5 min-w-[150px]">Business</th>
                      <th className="text-left px-4 py-2.5">Industry</th>
                      <th className="text-left px-4 py-2.5">City</th>
                      <th className="text-left px-4 py-2.5">Plan</th>
                      <th className="text-right px-4 py-2.5 whitespace-nowrap">Leads/mo</th>
                      <th className="text-right px-4 py-2.5 whitespace-nowrap">Bookings/mo</th>
                      <th className="text-right px-4 py-2.5 whitespace-nowrap">Est. MRR</th>
                      <th className="text-left px-4 py-2.5">Health</th>
                      <th className="text-right px-4 py-2.5">Since</th>
                      <th className="text-right px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const health      = computeHealth(c.monthly_leads, c.monthly_bookings)
                      const healthColor = HEALTH_COLORS[health]
                      const mrr         = PLAN_RATES[c.plan] ?? 0
                      const selected    = selectedIds.has(c.id)
                      return (
                        <tr
                          key={c.id}
                          className={`border-t border-white/[0.04] transition-colors
                            ${selected ? 'bg-[#ff7a18]/[0.04]' : 'hover:bg-white/[0.015]'}`}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRow(c.id)}
                              aria-label={`Select ${c.name}`}
                              className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30"
                              style={{ accentColor: '#ff7a18', width: 13, height: 13 }}
                            />
                          </td>
                          <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{c.name}</td>
                          <td className="px-4 py-3 text-[#9a9a9d] whitespace-nowrap">{c.industry}</td>
                          <td className="px-4 py-3 text-[#9a9a9d] whitespace-nowrap">{c.city}</td>
                          <td className="px-4 py-3"><PlanPill plan={c.plan} /></td>
                          <td className="px-4 py-3 text-right font-mono text-white tabular-nums">{c.monthly_leads}</td>
                          <td className="px-4 py-3 text-right font-mono text-white tabular-nums">{c.monthly_bookings}</td>
                          <td className="px-4 py-3 text-right font-mono text-[12.5px] font-semibold text-white tabular-nums">
                            ${mrr.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                              style={{ color: healthColor, borderColor: `${healthColor}33`, background: `${healthColor}12` }}
                            >
                              {health}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] text-[#6a6a6e] whitespace-nowrap">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setRemoveModal({ open: true, ids: [c.id], bulk: false })}
                              className="text-[11.5px] text-[#9a9a9d] hover:text-[#ff8a7a] transition-colors
                                         focus:outline-none focus:underline"
                              aria-label={`Remove ${c.name} from view`}
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
          {hasHidden && visibleClients.length > 0 && (
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

        {/* Client Health Focus panel */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <Activity size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Client Health</h2>
            </header>
            {visibleClients.length === 0 ? (
              <div className="px-5 py-4 text-[12.5px] text-[#9a9a9d]">
                No client health data yet.
              </div>
            ) : (
              <div className="px-5 py-3.5 flex flex-col gap-3 text-[12.5px]">
                <HealthRow
                  label="Healthy"
                  count={visibleClients.filter((c) => computeHealth(c.monthly_leads, c.monthly_bookings) === 'Healthy').length}
                  color="#22d093" note="Booking rate ≥ 60%"
                />
                <HealthRow
                  label="Watch"
                  count={visibleClients.filter((c) => computeHealth(c.monthly_leads, c.monthly_bookings) === 'Watch').length}
                  color="#ffae3c" note="Booking rate 30–59%"
                />
                <HealthRow label="At Risk" count={atRisk} color="#ff8a7a" note="Booking rate < 30%" />
                <div className="border-t border-white/[0.06] pt-2.5 flex items-center justify-between">
                  <span className="text-[#9a9a9d]">Total active</span>
                  <span className="text-[#ffae3c] font-semibold tabular-nums">{active}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4">
            <p className="text-[13px] font-semibold text-white mb-2">Next best actions</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-[#9a9a9d]">
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Check Watch clients for upsell or support opportunities</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Review new clients — onboarding may still be in progress</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Connect Stripe to replace estimated revenue figures</span>
              </li>
            </ul>
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

      <ConfirmActionDialog
        open={removeModal.open}
        title={removeModal.open && removeModal.bulk ? 'Remove selected records?' : 'Remove this record?'}
        body={
          removeModal.open && removeModal.bulk
            ? 'This will remove the selected clients from the current view. No data is deleted — use Reset view to restore them.'
            : 'This will remove the client from the current view. No data is deleted — use Reset view to restore it.'
        }
        confirmLabel={removeModal.open && removeModal.bulk ? 'Remove selected' : 'Remove record'}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveModal({ open: false })}
      />
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
