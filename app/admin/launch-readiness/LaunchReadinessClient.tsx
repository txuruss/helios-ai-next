'use client'

// Client Launch Readiness board. Read-only analysis across all clients;
// reuses updateClientStatus (with the same handoff-readiness confirmation)
// and the ClientDetailDrawer. No automatic status changes.

import { Fragment, useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, RotateCcw, Rocket } from 'lucide-react'
import type { LaunchReadinessRow, LaunchReadinessSummary, LaunchState } from '@/lib/data/admin-launch-readiness'
import type { ClientHandoffReadiness } from '@/lib/admin/client-handoff-readiness'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import PlanPill from '@/components/admin/ui/PlanPill'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import { ExpandToggle, ActionsToggle } from '@/components/admin/ui/ExpandableRow'
import CompactDataList, { type DataItem } from '@/components/admin/ui/CompactDataList'
import ExpandableActionPanel, { PanelActionButton } from '@/components/admin/ui/ExpandableActionPanel'
import ClientDetailDrawer from '@/app/admin/clients/ClientDetailDrawer'
import LaunchReportModal from '@/app/admin/clients/LaunchReportModal'
import { updateClientStatus } from '@/lib/actions/admin-clients'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/admin/client-status'
import { buildClientLaunchReportMarkdown, type LaunchReportInput } from '@/lib/admin/client-launch-report'

function rowToReportInput(r: LaunchReadinessRow): LaunchReportInput {
  return {
    clientName: r.business_name, plan: r.plan, status: r.status, paymentStatus: r.payment_status,
    launchState: r.launchState, hasHandoffDoc: r.hasHandoffDoc, hasBrandAssets: r.hasBrandAssets,
    hasSetupDoc: r.hasSetupDoc, taskTotal: r.taskTotal, taskDone: r.taskDone,
    taskBlocked: r.taskBlocked, taskOverdue: r.taskOverdue, readiness: r.readiness, nextAction: r.nextAction,
  }
}

const LAUNCH_CFG: Record<LaunchState, { label: string; color: string }> = {
  ready:            { label: 'Ready',            color: '#22d093' },
  needs_files:      { label: 'Needs files',      color: '#ffae3c' },
  needs_payment:    { label: 'Needs payment',    color: '#ffae3c' },
  needs_onboarding: { label: 'Needs onboarding', color: '#3b9eff' },
  blocked:          { label: 'Blocked',          color: '#ff5247' },
  active:           { label: 'Active',           color: '#22d093' },
  archived:         { label: 'Archived',         color: '#6a6a6e' },
}
const PAYMENT_TONE: Record<string, string> = {
  paid: '#22d093', deposit_paid: '#3b9eff', unpaid: '#ffae3c', overdue: '#ff5247', cancelled: '#6a6a6e',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' }, { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' },
]
const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All payments' }, { value: 'paid', label: 'Paid' },
  { value: 'deposit_paid', label: 'Deposit paid' }, { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' }, { value: 'cancelled', label: 'Cancelled' },
]
const READINESS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All readiness' },
  { value: 'ready', label: 'Ready to launch' },
  { value: 'needs_files', label: 'Missing files' },
  { value: 'needs_payment', label: 'Missing payment' },
  { value: 'needs_onboarding', label: 'Incomplete onboarding' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'active', label: 'Already active' },
]
const PLAN_OPTIONS = [
  { value: 'all', label: 'All plans' }, { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Booking OS' }, { value: 'scale', label: 'Helios AIOS' },
]

type StatusModal = { open: false } | { open: true; id: string; name: string; readiness: ClientHandoffReadiness }
type DrawerState = { id: string; tab?: 'overview' | 'payments' | 'files' } | null

interface Props {
  rows:                 LaunchReadinessRow[]
  summary:              LaunchReadinessSummary
  filesMigrationNeeded: boolean
  tasksMigrationNeeded: boolean
  error:                string | null
}

export default function LaunchReadinessClient({ rows, summary, filesMigrationNeeded, tasksMigrationNeeded, error }: Props) {
  const router = useRouter()
  const [search,    setSearch]    = useState('')
  const [statusF,   setStatusF]   = useState('all')
  const [paymentF,  setPaymentF]  = useState('all')
  const [readyF,    setReadyF]    = useState('all')
  const [planF,     setPlanF]     = useState('all')
  const [statusModal, setStatusModal] = useState<StatusModal>({ open: false })
  const [statusErr, setStatusErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [drawer, setDrawer]       = useState<DrawerState>(null)
  const [drawerKey, setDrawerKey] = useState(0)
  const [reportInput, setReportInput] = useState<LaunchReportInput | null>(null)
  const [copyToast, setCopyToast] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    // One row open at a time — opening a row closes any other.
    setExpandedId((cur) => (cur === id ? null : id))
  }

  async function copyRow(r: LaunchReadinessRow) {
    try {
      await navigator.clipboard.writeText(buildClientLaunchReportMarkdown(rowToReportInput(r)))
      setCopyToast('Launch report copied.')
    } catch {
      setCopyToast('Could not copy report. Please try again.')
    }
    setTimeout(() => setCopyToast(null), 2500)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusF  !== 'all' && r.status !== statusF) return false
      if (paymentF !== 'all' && (r.payment_status ?? '') !== paymentF) return false
      if (readyF   !== 'all' && r.launchState !== readyF) return false
      if (planF    !== 'all' && r.plan !== planF) return false
      if (!q) return true
      return (
        r.business_name.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        r.plan.toLowerCase().includes(q)
      )
    })
  }, [rows, search, statusF, paymentF, readyF, planF])

  const filtersActive = search !== '' || statusF !== 'all' || paymentF !== 'all' || readyF !== 'all' || planF !== 'all'
  function clearFilters() { setSearch(''); setStatusF('all'); setPaymentF('all'); setReadyF('all'); setPlanF('all') }

  // Launch Focus (priority order).
  const nonActive = rows.filter((r) => r.status !== 'active')
  const focus: string[] = []
  const overdueClients = nonActive.filter((r) => r.taskOverdue > 0).length
  const missingHandoff = nonActive.filter((r) => !r.hasHandoffDoc).length
  const missingBrand   = nonActive.filter((r) => !r.hasBrandAssets).length
  if (overdueClients > 0)         focus.push(`${overdueClients} client${overdueClients !== 1 ? 's' : ''} blocked by overdue onboarding work.`)
  if (summary.missingPayment > 0) focus.push(`${summary.missingPayment} client${summary.missingPayment !== 1 ? 's' : ''} missing payment before launch.`)
  if (missingHandoff > 0)         focus.push(`${missingHandoff} client${missingHandoff !== 1 ? 's' : ''} need handoff documents uploaded.`)
  if (missingBrand > 0)           focus.push(`${missingBrand} client${missingBrand !== 1 ? 's' : ''} need brand assets.`)
  if (summary.readyToLaunch > 0)  focus.push(`${summary.readyToLaunch} client${summary.readyToLaunch !== 1 ? 's' : ''} ready for active status review.`)
  if (summary.activeClients > 0)  focus.push(`${summary.activeClients} active client${summary.activeClients !== 1 ? 's' : ''}.`)
  if (focus.length === 0) focus.push('No launch issues need attention.')

  function confirmActive() {
    if (!statusModal.open) return
    const { id } = statusModal
    setStatusErr(null)
    startTransition(async () => {
      const r = await updateClientStatus(id, 'active')
      if (r.ok) { setStatusModal({ open: false }); router.refresh() }
      else setStatusErr(r.error ?? 'Could not update client status. Please try again.')
    })
  }

  const activeCopy = (() => {
    if (!statusModal.open) return { body: '', confirmLabel: '' }
    const errSuffix = statusErr ? `\n\n${statusErr}` : ''
    if (!statusModal.readiness.ready) {
      const items = [...statusModal.readiness.missingItems, ...statusModal.readiness.warnings].map((i) => `- ${i}`).join('\n')
      return {
        body: `This client may not be fully ready for handoff.\n\nMissing readiness items:\n${items}\n\nYou can still mark this client active, but review these items first.${errSuffix}`,
        confirmLabel: 'Mark active anyway',
      }
    }
    return {
      body: `This client appears ready to go live. Active clients count toward active client totals and MRR.${errSuffix}`,
      confirmLabel: 'Mark active',
    }
  })()

  const migrationBanner = filesMigrationNeeded || tasksMigrationNeeded

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-1.5">
        <Link href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white flex items-center gap-2">
            <Rocket size={20} className="text-[#ff7a18]" /> Client Launch Readiness
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                           px-2.5 py-1 rounded-full border border-[#22d093]/30 bg-[#22d093]/[0.07] text-[#22d093]">
            Live readiness data
          </span>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Review which clients are ready to launch, missing handoff items, unpaid, blocked, or incomplete.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">{error}</div>
      )}
      {migrationBanner && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          Some readiness data is unavailable until the onboarding tasks / client files migrations are applied.
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard label="Ready To Launch"      value={summary.readyToLaunch}        tone={summary.readyToLaunch > 0 ? 'success' : 'neutral'}   sublabel="All checks pass" />
        <AdminKpiCard label="Missing Files"        value={summary.missingFiles}         tone={summary.missingFiles > 0 ? 'warning' : 'neutral'}    sublabel="Handoff/brand/setup" />
        <AdminKpiCard label="Missing Payment"      value={summary.missingPayment}       tone={summary.missingPayment > 0 ? 'warning' : 'neutral'}  sublabel="Unpaid / overdue" />
        <AdminKpiCard label="Incomplete Onboarding" value={summary.incompleteOnboarding} tone={summary.incompleteOnboarding > 0 ? 'info' : 'neutral'} sublabel="Open tasks" />
        <AdminKpiCard label="Blocked By Tasks"     value={summary.blockedByTasks}       tone={summary.blockedByTasks > 0 ? 'danger' : 'neutral'}   sublabel="Blocked / overdue" />
        <AdminKpiCard label="Active Clients"       value={summary.activeClients}        tone="info"                                                sublabel="Already live" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
              <input type="text" placeholder="Search client, email, plan…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all" />
            </div>
            <Sel value={statusF} onChange={setStatusF} options={STATUS_OPTIONS} />
            <Sel value={paymentF} onChange={setPaymentF} options={PAYMENT_OPTIONS} />
            <Sel value={readyF} onChange={setReadyF} options={READINESS_OPTIONS} />
            <Sel value={planF} onChange={setPlanF} options={PLAN_OPTIONS} />
            {filtersActive && (
              <button type="button" onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[12px] text-[#9a9a9d] hover:text-white hover:bg-white/[0.05] transition-all">
                <RotateCcw size={11} /> Clear
              </button>
            )}
          </div>

          {/* Table */}
          {rows.length === 0 ? (
            <Empty title="No clients yet" body="Launch readiness will appear after clients are converted." />
          ) : filtered.length === 0 ? (
            <Empty title="No matches" body="No clients match the current filters." />
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[640px]">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                    <tr>
                      <th className="px-2 py-2.5 w-[28px]" aria-label="Expand" />
                      <th className="text-left px-3 py-2.5 min-w-[150px]">Client</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5">Payment</th>
                      <th className="text-left px-3 py-2.5">Readiness</th>
                      <th className="text-left px-3 py-2.5 min-w-[150px]">Next Action</th>
                      <th className="text-right px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const lc = LAUNCH_CFG[r.launchState]
                      const paymentMissing = r.payment_status === 'unpaid' || r.payment_status === 'overdue'
                      const isOpen = expandedId === r.id

                      const missingItems: string[] = []
                      if (!r.hasHandoffDoc)  missingItems.push('Handoff doc')
                      if (!r.hasBrandAssets) missingItems.push('Brand assets')
                      if (!r.hasSetupDoc)    missingItems.push('Setup doc')
                      if (r.taskBlocked > 0) missingItems.push(`${r.taskBlocked} blocked`)
                      if (r.taskOverdue > 0) missingItems.push(`${r.taskOverdue} overdue`)
                      if (paymentMissing)    missingItems.push(r.payment_status === 'overdue' ? 'Payment overdue' : 'Payment unpaid')

                      const details: DataItem[] = [
                        { label: 'Plan', value: <PlanPill plan={r.plan} /> },
                        {
                          label: 'File checklist',
                          full: true,
                          value: (
                            <div className="flex gap-4 flex-wrap">
                              <FileFlag ok={r.hasHandoffDoc} label="Handoff doc" />
                              <FileFlag ok={r.hasBrandAssets} label="Brand assets" />
                              <FileFlag ok={r.hasSetupDoc} label="Setup doc" />
                            </div>
                          ),
                        },
                        { label: 'Task completion', value: `${r.taskDone}/${r.taskTotal} done` },
                        { label: 'Open tasks', value: r.taskOpen },
                        { label: 'Blocked tasks', value: <span style={{ color: r.taskBlocked > 0 ? '#ff5247' : undefined }}>{r.taskBlocked}</span> },
                        { label: 'Overdue tasks', value: <span style={{ color: r.taskOverdue > 0 ? '#ff5247' : undefined }}>{r.taskOverdue}</span> },
                        { label: 'Payment status', value: r.payment_status ? r.payment_status.replace('_', ' ') : '—' },
                        { label: 'Client status', value: STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status },
                      ]

                      return (
                        <Fragment key={r.id}>
                          <tr className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                            <td className="px-2 py-2.5">
                              <ExpandToggle open={isOpen} onToggle={() => toggleExpand(r.id)} label={`Toggle details for ${r.business_name}`} />
                            </td>
                            <td className="px-3 py-2.5">
                              <button type="button" onClick={() => setDrawer({ id: r.id })}
                                className="text-white font-medium hover:text-[#ffae3c] transition-colors text-left focus:outline-none focus:underline">
                                {r.business_name}
                              </button>
                              {(r.contact_name || r.email) && (
                                <div className="text-[10.5px] text-[#6a6a6e] truncate max-w-[170px]">{r.email ?? r.contact_name}</div>
                              )}
                            </td>
                            <td className="px-3 py-2.5"><Pill color={STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] ?? '#6a6a6e'} label={STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status} /></td>
                            <td className="px-3 py-2.5">
                              {r.payment_status
                                ? <Pill color={PAYMENT_TONE[r.payment_status] ?? '#6a6a6e'} label={r.payment_status.replace('_', ' ')} />
                                : <span className="text-[#6a6a6e]">—</span>}
                            </td>
                            <td className="px-3 py-2.5"><Pill color={lc.color} label={lc.label} /></td>
                            <td className="px-3 py-2.5 text-[#9a9a9d] max-w-[180px]">{r.nextAction}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex justify-end">
                                <ActionsToggle open={isOpen} onToggle={() => toggleExpand(r.id)} label={isOpen ? 'Close' : 'Actions'} />
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={7} className="p-0">
                              <ExpandableActionPanel
                                open={isOpen}
                                title="Launch recommendation"
                                description={r.nextAction}
                                meta={
                                  <>
                                    <Pill color={lc.color} label={lc.label} />
                                    <Pill color={STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] ?? '#6a6a6e'} label={STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status} />
                                    {r.payment_status && <Pill color={PAYMENT_TONE[r.payment_status] ?? '#6a6a6e'} label={r.payment_status.replace('_', ' ')} />}
                                    <span className="text-[11px] text-[#9a9a9d]">
                                      {missingItems.length === 0 ? 'No missing launch items' : `Missing: ${missingItems.join(' · ')}`}
                                    </span>
                                  </>
                                }
                                actions={
                                  <>
                                    <PanelActionButton variant="primary" onClick={() => setReportInput(rowToReportInput(r))}>View Report</PanelActionButton>
                                    <PanelActionButton variant="secondary" onClick={() => { void copyRow(r) }}>Copy Report</PanelActionButton>
                                    <PanelActionButton variant="secondary" onClick={() => setDrawer({ id: r.id })}>Open Client</PanelActionButton>
                                    <PanelActionButton variant="info" onClick={() => setDrawer({ id: r.id, tab: 'files' })}>Open Files</PanelActionButton>
                                    <PanelActionButton variant="info" onClick={() => setDrawer({ id: r.id, tab: 'payments' })}>Open Payment</PanelActionButton>
                                    <PanelActionButton variant="secondary" onClick={() => router.push('/admin/delivery')}>Open Delivery</PanelActionButton>
                                    {r.status !== 'active' && (
                                      <PanelActionButton variant="success" onClick={() => { setStatusErr(null); setStatusModal({ open: true, id: r.id, name: r.business_name, readiness: r.readiness }) }}>
                                        Mark Active
                                      </PanelActionButton>
                                    )}
                                  </>
                                }
                              >
                                <CompactDataList items={details} />
                              </ExpandableActionPanel>
                            </td>
                          </tr>
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Launch Focus */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <Rocket size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Launch Focus</h2>
            </header>
            <div className="px-5 py-3.5 flex flex-col gap-2.5">
              {focus.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                  <span className="text-[12.5px] text-[#cfd3dc] leading-snug">{f}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* Mark Active confirmation (reuses the handoff readiness warning) */}
      <ConfirmActionDialog
        open={statusModal.open}
        title="Mark client active?"
        body={activeCopy.body}
        confirmLabel={activeCopy.confirmLabel}
        loading={pending}
        onConfirm={confirmActive}
        onCancel={() => { setStatusModal({ open: false }); setStatusErr(null) }}
      />

      {/* Launch report preview modal */}
      {reportInput && <LaunchReportModal input={reportInput} onClose={() => setReportInput(null)} />}

      {/* Copy toast */}
      {copyToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-xl border border-white/[0.12] bg-[#0f1012] shadow-2xl text-[12.5px] text-[#cfd3dc]">
          {copyToast}
        </div>
      )}

      {/* Client detail drawer (reused) */}
      {drawer && (
        <ClientDetailDrawer
          clientId={drawer.id}
          reloadKey={drawerKey}
          initialTab={drawer.tab}
          onClose={() => setDrawer(null)}
          onUpdatePayment={() => router.push('/admin/clients')}
          onChanged={() => { setDrawerKey((k) => k + 1); router.refresh() }}
        />
      )}
    </div>
  )
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012] text-[13px] text-white cursor-pointer focus:outline-none focus:border-[#ff7a18]/40 transition-all">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function FileFlag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px]" style={{ color: ok ? '#22d093' : '#ff8a7a' }}>
      <span aria-hidden className="font-bold w-2.5 text-center">{ok ? '✓' : '✗'}</span>
      <span>{label}</span>
      <span className="sr-only">{ok ? 'present' : 'missing'}</span>
    </span>
  )
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap capitalize"
      style={{ color, borderColor: `${color}33`, background: `${color}12` }}>
      {label}
    </span>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12 text-center flex flex-col items-center gap-2">
      <div className="text-[15px] font-medium text-white">{title}</div>
      <p className="text-[13px] text-[#9a9a9d] max-w-[420px]">{body}</p>
    </div>
  )
}
