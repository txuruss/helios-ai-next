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
import type {
  AdminClientRow, AdminClientStatus, PaymentStatus, PaymentMethod,
} from '@/lib/data/admin-clients'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import PlanPill from '@/components/admin/ui/PlanPill'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import {
  updateClientStatus, updateClientPayment,
} from '@/lib/actions/admin-clients'
import {
  STATUS_TRANSITIONS, STATUS_CONFIRM_COPY, type ClientLifecycleStatus,
} from '@/lib/admin/client-status'
import ClientDetailDrawer from './ClientDetailDrawer'

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

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  unpaid:       { label: 'Unpaid',       color: '#ffae3c' },
  deposit_paid: { label: 'Deposit Paid', color: '#3b9eff' },
  paid:         { label: 'Paid',         color: '#22d093' },
  overdue:      { label: 'Overdue',      color: '#ff5247' },
  cancelled:    { label: 'Cancelled',    color: '#6a6a6e' },
}

const PAYMENT_STATUS_SELECT: { value: PaymentStatus; label: string }[] = [
  { value: 'unpaid',       label: 'Unpaid'        },
  { value: 'deposit_paid', label: 'Deposit Paid'  },
  { value: 'paid',         label: 'Paid'          },
  { value: 'overdue',      label: 'Overdue'       },
  { value: 'cancelled',    label: 'Cancelled'     },
]

const PAYMENT_METHOD_SELECT: { value: PaymentMethod; label: string }[] = [
  { value: 'paypal',        label: 'PayPal'        },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash'          },
  { value: 'other',         label: 'Other'         },
]

const todayIso = () => new Date().toISOString().slice(0, 10)

// A client is "effectively overdue" if explicitly flagged, or its due date
// has passed and it isn't settled. Mirrors the Mission Control rollup.
function isOverdue(c: AdminClientRow): boolean {
  if (c.payment_status === 'paid' || c.payment_status === 'cancelled') return false
  if (c.payment_status === 'overdue') return true
  return c.next_payment_due !== null && c.next_payment_due < todayIso()
}

function isDueSoon(c: AdminClientRow): boolean {
  if (c.payment_status === 'paid' || c.payment_status === 'cancelled') return false
  if (c.next_payment_due === null) return false
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  return c.next_payment_due >= todayIso() && c.next_payment_due <= soon
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
  | { open: true; id: string; name: string; from: ClientLifecycleStatus; to: ClientLifecycleStatus }

interface ClientSuggestionSummary {
  label:      string
  title:      string
  severity:   'critical' | 'warning' | 'info' | 'success'
  actionType: string
}

const SUGGESTION_TONE: Record<ClientSuggestionSummary['severity'], string> = {
  critical: '#ff5247', warning: '#ffae3c', info: '#6db4ff', success: '#22d093',
}

interface Props {
  clients: AdminClientRow[]
  error?: string | null
  suggestions?: Record<string, ClientSuggestionSummary>
}

export default function ClientsPageClient({ clients, error, suggestions = {} }: Props) {
  const router = useRouter()
  const [search,       setSearch]       = useState('')
  const [planFilter,   setPlanFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal,        setModal]        = useState<ActionModal>({ open: false })
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null)
  const [drawerId,     setDrawerId]     = useState<string | null>(null)
  const [drawerKey,    setDrawerKey]    = useState(0)
  const [payClient,    setPayClient]    = useState<AdminClientRow | null>(null)
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

  // Payment insight — from real stored payment fields only.
  const paidCount    = clients.filter((c) => c.payment_status === 'paid').length
  const unpaidCount   = clients.filter((c) => c.payment_status === 'unpaid' || c.payment_status === 'deposit_paid').length
  const overdueCount  = clients.filter(isOverdue).length
  const dueSoonCount  = clients.filter(isDueSoon).length

  function runAction() {
    if (!modal.open) return
    const { id, to } = modal
    setActionError(null)
    startTransition(async () => {
      const result = await updateClientStatus(id, to)
      if (result.ok) {
        setModal({ open: false })
        router.refresh()
      } else {
        setActionError(result.error ?? 'Could not update client status. Please try again.')
      }
    })
  }

  function openStatusChange(c: AdminClientRow, to: ClientLifecycleStatus) {
    setStatusMenuFor(null)
    setActionError(null)
    setModal({ open: true, id: c.id, name: c.name, from: c.status, to })
  }

  return (
    <>
      {/* ── KPI Command Strip ─────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard label="Active Clients"   value={active}                          tone="neutral"                           sublabel="Status: active"       />
        <AdminKpiCard label="Monthly Leads"     value={totalLeads.toLocaleString()}     tone="info"                              sublabel="Across all clients"   />
        <AdminKpiCard label="Monthly Bookings"  value={totalBook.toLocaleString()}      tone="success"                           sublabel="Across all clients"   />
        <AdminKpiCard label="Estimated MRR"     value={`$${totalMRR.toLocaleString()}`} tone="orange"                            sublabel="PayPal not connected" />
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
                <table className="w-full text-[12.5px] min-w-[1180px]">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                    <tr>
                      <th className="text-left px-4 py-2.5 min-w-[150px]">Business</th>
                      <th className="text-left px-4 py-2.5">Industry</th>
                      <th className="text-left px-4 py-2.5">Plan</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                      <th className="text-left px-4 py-2.5">Payment</th>
                      <th className="text-right px-4 py-2.5 whitespace-nowrap">Next Due</th>
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
                      const overdue     = isOverdue(c)
                      // Reflect "effectively overdue" in the pill even if the
                      // stored status hasn't been flipped to 'overdue' yet.
                      const payCfg      = overdue ? PAYMENT_STATUS_CONFIG.overdue : PAYMENT_STATUS_CONFIG[c.payment_status]
                      return (
                        <tr key={c.id} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.015]">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setDrawerId(c.id)}
                              className="text-white font-medium hover:text-[#ffae3c] transition-colors focus:outline-none focus:underline text-left"
                            >
                              {c.name}
                            </button>
                            {suggestions[c.id] && (
                              <div className="text-[10.5px] mt-0.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SUGGESTION_TONE[suggestions[c.id].severity] }} />
                                <span className="text-[#9a9a9d]">Next: {suggestions[c.id].label}</span>
                              </div>
                            )}
                          </td>
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
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                              style={{ color: payCfg.color, borderColor: `${payCfg.color}33`, background: `${payCfg.color}12` }}
                            >
                              {payCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-[11.5px] whitespace-nowrap tabular-nums"
                              style={{ color: overdue ? '#ff5247' : '#9a9a9d' }}>
                            {c.next_payment_due ? new Date(c.next_payment_due).toLocaleDateString() : '—'}
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
                            <div className="flex justify-end items-center gap-3 text-[11.5px] whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => { setActionError(null); setPayClient(c) }}
                                className="text-[#3b9eff] hover:text-[#7ec0ff] transition-colors focus:outline-none focus:underline"
                              >
                                Payment
                              </button>
                              <button
                                type="button"
                                onClick={() => setDrawerId(c.id)}
                                className="text-[#9a9a9d] hover:text-white transition-colors focus:outline-none focus:underline"
                              >
                                View
                              </button>
                              {/* Status change menu */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setStatusMenuFor((cur) => cur === c.id ? null : c.id)}
                                  className="text-[#9a9a9d] hover:text-white transition-colors focus:outline-none focus:underline"
                                  aria-haspopup="menu"
                                  aria-expanded={statusMenuFor === c.id}
                                >
                                  Status ▾
                                </button>
                                {statusMenuFor === c.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setStatusMenuFor(null)} />
                                    <div className="absolute right-0 z-50 mt-1 w-[180px] rounded-xl border border-white/[0.10] bg-[#0f1012] shadow-2xl py-1">
                                      {STATUS_TRANSITIONS[c.status].map((tr) => (
                                        <button
                                          key={tr.to}
                                          type="button"
                                          onClick={() => openStatusChange(c, tr.to)}
                                          className="w-full text-left px-3.5 py-2 text-[12.5px] text-[#cfd3dc] hover:bg-white/[0.05] hover:text-white transition-colors"
                                        >
                                          {tr.label}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
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

                {/* Payment insight — manual tracking, not PayPal-verified */}
                <div className="border-t border-white/[0.06] pt-2.5 flex flex-col gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6a6a6e]">Payments (manual)</p>
                  <HealthRow label="Paid"      count={paidCount}    color="#22d093" note="Recorded paid" />
                  <HealthRow label="Unpaid"    count={unpaidCount}  color="#ffae3c" note="Unpaid / deposit" />
                  <HealthRow label="Overdue"   count={overdueCount} color="#ff5247" note="Past due" />
                  <HealthRow label="Due soon"  count={dueSoonCount} color="#3b9eff" note="Next 7 days" />
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

      {/* Status-change confirmation dialog */}
      <ConfirmActionDialog
        open={modal.open}
        title={modal.open ? STATUS_CONFIRM_COPY[modal.to].title : ''}
        body={
          modal.open
            ? `${STATUS_CONFIRM_COPY[modal.to].body} (Client: "${modal.name}".)${actionError ? `\n\n${actionError}` : ''}`
            : ''
        }
        confirmLabel={modal.open ? STATUS_CONFIRM_COPY[modal.to].confirmLabel : ''}
        loading={isPending}
        onConfirm={runAction}
        onCancel={() => { setModal({ open: false }); setActionError(null) }}
      />

      {/* Client detail drawer */}
      {drawerId && (
        <ClientDetailDrawer
          clientId={drawerId}
          reloadKey={drawerKey}
          onClose={() => setDrawerId(null)}
          onUpdatePayment={() => {
            const c = clients.find((x) => x.id === drawerId)
            if (c) { setActionError(null); setPayClient(c) }
          }}
          onChanged={() => { setDrawerKey((k) => k + 1); router.refresh() }}
        />
      )}

      {/* Manual payment update modal */}
      {payClient && (
        <PaymentModal
          client={payClient}
          onClose={() => { setPayClient(null); setActionError(null) }}
          onSaved={() => { setPayClient(null); router.refresh(); setDrawerKey((k) => k + 1) }}
        />
      )}
    </>
  )
}

function PaymentModal({
  client, onClose, onSaved,
}: {
  client:  AdminClientRow
  onClose: () => void
  onSaved: () => void
}) {
  const [status,  setStatus]  = useState<PaymentStatus>(client.payment_status)
  const [method,  setMethod]  = useState<PaymentMethod | ''>(client.payment_method ?? '')
  const [lastPay, setLastPay] = useState(client.last_payment_date ?? '')
  const [nextDue, setNextDue] = useState(client.next_payment_due ?? '')
  const [invoice, setInvoice] = useState(client.paypal_invoice_id ?? '')
  const [notes,   setNotes]   = useState(client.payment_notes ?? '')
  const [err,     setErr]     = useState<string | null>(null)
  const [saving,  startSave]  = useTransition()

  function save() {
    setErr(null)
    startSave(async () => {
      const result = await updateClientPayment(client.id, {
        payment_status:    status,
        payment_method:    method === '' ? null : method,
        last_payment_date: lastPay,
        next_payment_due:  nextDue,
        paypal_invoice_id: invoice,
        payment_notes:     notes,
      })
      if (result.ok) onSaved()
      else setErr(result.error ?? 'Could not save. Please try again.')
    })
  }

  const inputCls =
    'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white ' +
    'placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all'
  const labelCls = 'text-[11px] font-medium text-[#9a9a9d] mb-1 block'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[460px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
          <div>
            <h2 className="text-[15px] font-semibold text-white leading-snug">Update payment</h2>
            <p className="text-[12px] text-[#6a6a6e] mt-0.5">{client.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors shrink-0 mt-0.5">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                      className={`${inputCls} cursor-pointer`}>
                {PAYMENT_STATUS_SELECT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
                      className={`${inputCls} cursor-pointer`}>
                <option value="">—</option>
                {PAYMENT_METHOD_SELECT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Last payment date</label>
              <input type="date" value={lastPay} onChange={(e) => setLastPay(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Next payment due</label>
              <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>PayPal invoice ID</label>
            <input type="text" value={invoice} onChange={(e) => setInvoice(e.target.value)}
                   placeholder="e.g. INV2-XXXX-XXXX-XXXX" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Payment notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                      placeholder="Manual notes — e.g. paid deposit via PayPal, balance due on launch"
                      className={`${inputCls} resize-none`} />
          </div>
          <p className="text-[10.5px] text-[#6a6a6e] leading-relaxed">
            Manual record only — this does not verify any payment or contact PayPal.
          </p>
          {err && <p className="text-[12px] text-[#ff8a7a]">{err}</p>}
        </div>

        <div className="flex justify-end gap-2.5 px-5 pb-5">
          <button type="button" onClick={onClose} disabled={saving}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#9a9a9d] border border-white/[0.08] bg-white/[0.03]
                             hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/20">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]
                             hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/40">
            {saving ? 'Saving…' : 'Save payment update'}
          </button>
        </div>
      </div>
    </div>
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

// Full client detail now lives in the right-side ClientDetailDrawer.
