import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  getAdminAuditMetrics,
  getLatestAdminAuditSubmissions,
} from '@/lib/data/admin-audits'
import { getAdminMissionControlSummary } from '@/lib/data/admin-mission-control'
import { getAdminClientRevenue, getAdminClientPaymentHealth } from '@/lib/data/admin-clients'
import { getOnboardingAlertSummary } from '@/lib/data/admin-client-tasks'
import { getTopClientSuggestions } from '@/lib/data/admin-client-suggestions'
import { getOutreachSummary } from '@/lib/data/admin-outreach'
import { relevanceAiConfigured } from '@/lib/ai/relevance-audit-analysis'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import MissionControlAuditTable from './MissionControlAuditTable'
import {
  CheckCircle2, AlertCircle, ArrowRight, TrendingUp, Zap,
  FileText, Users, Building2, Settings, Activity, Wallet, ClipboardList, Rocket, Megaphone,
} from 'lucide-react'

export const metadata = { title: 'Mission Control — Helios AI Admin' }

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `$${n}`
}

const TASK_PRIORITY_TONE: Record<string, string> = { low: '#6a6a6e', normal: '#9a9a9d', high: '#ffae3c', urgent: '#ff5247' }
const TASK_STATUS_TONE:   Record<string, string> = { todo: '#6a6a6e', in_progress: '#3b9eff', blocked: '#ff5247', done: '#22d093' }
const TASK_STATUS_LABEL:  Record<string, string> = { todo: 'To do', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' }
const SUGGESTION_DOT:     Record<string, string> = { critical: '#ff5247', warning: '#ffae3c', info: '#6db4ff', success: '#22d093' }

// Colored mini stat for the Onboarding Alerts panel.
function AlertStat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="rounded-xl border px-3.5 py-2.5" style={{ borderColor: `${color}33`, background: `${color}0f` }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6a6a6e] truncate">{label}</div>
      <div className="text-[16px] font-bold tabular-nums mt-1 leading-none" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[#6a6a6e] mt-0.5 truncate">{sub}</div>
    </div>
  )
}

function MiniPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap capitalize"
          style={{ color, borderColor: `${color}33`, background: `${color}12` }}>
      {label}
    </span>
  )
}

// Compact stat for the Outreach Focus card.
function OutreachStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[#6a6a6e] uppercase tracking-[0.08em] mt-1 truncate">{label}</div>
    </div>
  )
}

export default async function AdminMissionControlPage() {
  const session = await requireAdmin({ path: '/admin/mission-control' })

  const [auditMetrics, latestAudits, summary, revenue, payments, onboarding, clientSuggestions, outreach] = await Promise.all([
    getAdminAuditMetrics(),
    getLatestAdminAuditSubmissions(6),
    getAdminMissionControlSummary(),
    getAdminClientRevenue(),
    getAdminClientPaymentHealth(),
    getOnboardingAlertSummary(),
    getTopClientSuggestions(3),
    getOutreachSummary(),
  ])

  const firstName      = (session.fullName ?? session.email).split(' ')[0]
  const todayStr       = new Date().toISOString().slice(0, 10)
  const hasCritical    = !!auditMetrics.error || !!summary.error
  // PayPal is the primary payment provider. "Configured" = credentials
  // present; it does NOT mean payments are verified (no transaction
  // reading exists yet), so revenue stays "Estimated" regardless.
  const paypalReady    = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET
  const relevanceReady = relevanceAiConfigured()

  // Revenue figures are computed from REAL stored client fees (admin_clients).
  // They are $0 until clients are converted, and labelled "Estimated"
  // until PayPal payment verification exists. Never fabricated.
  const activeClients  = revenue.activeClients
  const mrr            = revenue.mrr
  const arr            = revenue.arr
  const setupRevenue   = revenue.setupRevenue
  const avgMonthly     = revenue.avgMonthly
  const projected12mo  = revenue.projected12mo

  const newAudits = auditMetrics.newToday
  const pending   = auditMetrics.pending
  const highPri   = auditMetrics.highPriority

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff7a18]">
          Founder Command Center
        </span>
        <h1 className="text-[24px] font-bold tracking-tight text-white">
          Welcome back, {firstName}.
        </h1>
        <p className="text-[13px] text-[#9a9a9d]">
          Live overview of audit intake, clients, leads, and platform health.
        </p>
      </header>

      {/* ── KPI Command Strip ────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard
          label="New Audits Today"
          value={newAudits}
          tone={newAudits > 0 ? 'success' : 'neutral'}
          sublabel={newAudits > 0 ? 'Needs review' : 'None yet'}
        />
        <AdminKpiCard
          label="Pending Review"
          value={pending}
          tone={pending > 0 ? 'warning' : 'neutral'}
          sublabel={pending > 0 ? 'Awaiting action' : 'Queue clear'}
        />
        <AdminKpiCard
          label="High Priority"
          value={highPri}
          tone={highPri > 0 ? 'danger' : 'neutral'}
          sublabel={highPri > 0 ? 'Urgent leads' : 'None flagged'}
        />
        <AdminKpiCard
          label="Active Clients"
          value={activeClients}
          tone="info"
          sublabel="From client CRM"
        />
        <AdminKpiCard
          label="Leads (7d)"
          value={summary.recentLeads}
          tone="info"
          sublabel="Last 7 days"
        />
        <AdminKpiCard
          label="Bookings (7d)"
          value={summary.recentBookings}
          tone="info"
          sublabel="Last 7 days"
        />
      </section>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {hasCritical && (
        <div className="rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] p-3.5 flex items-start gap-3">
          <AlertCircle size={15} className="text-[#ffae3c] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[#ffae3c]">
            {auditMetrics.error && <div>Audit metrics unavailable: {auditMetrics.error}</div>}
            {summary.error      && <div>Mission Control summary: {summary.error}</div>}
            <div className="text-[11.5px] text-[#9a9a9d] mt-0.5">
              Confirm the Supabase service-role key is set and required migrations are applied.
            </div>
          </div>
        </div>
      )}

      {/* ── Outreach Focus (compact) ─────────────────────────────── */}
      {!outreach.migrationNeeded && (
        <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#ff7a18]/10">
            <div className="flex items-center gap-2">
              <Megaphone size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Outreach Focus</h2>
            </div>
            <Link href="/admin/outreach"
              className="text-[12px] text-[#ffae3c] hover:text-white inline-flex items-center gap-1.5 transition-colors">
              Open Outreach Dashboard <ArrowRight size={11} />
            </Link>
          </div>
          <div className="px-4 py-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <OutreachStat label="Contacted Today" value={outreach.contactedToday} color="#3b9eff" />
            <OutreachStat label="Replies"         value={outreach.newReplies}     color="#a07cff" />
            <OutreachStat label="Follow-Ups Due"  value={outreach.followUpsDue}   color="#ffae3c" />
            <OutreachStat label="Hot Leads"       value={outreach.hotLeads}       color="#22d093" />
            <OutreachStat label="Calls Booked"    value={outreach.callsBooked}    color="#22d093" />
          </div>
        </section>
      )}

      {/* ── MAIN ROW: Latest Audits (2/3) + Right Panels (1/3) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Latest Audit Submissions */}
        <section className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
          <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
            <div>
              <h2 className="text-[14px] font-semibold text-white">Latest Audit Submissions</h2>
              <p className="text-[11.5px] text-[#9a9a9d] mt-0.5">
                {auditMetrics.error
                  ? 'Intake table unavailable.'
                  : `${auditMetrics.total} total · ${auditMetrics.pending} pending review`}
              </p>
            </div>
            <Link
              href="/admin/audits"
              className="text-[12px] text-[#ffae3c] hover:text-white inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              View all <ArrowRight size={11} />
            </Link>
          </header>

          {latestAudits.error ? (
            <div className="px-5 py-5 text-[13px] text-[#ff8a7a]">{latestAudits.error}</div>
          ) : (
            <MissionControlAuditTable rows={latestAudits.rows} />
          )}
        </section>

        {/* Right column: Quick Actions + Founder Focus */}
        <div className="flex flex-col gap-4">

          {/* Quick Actions */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.04]">
              <Zap size={13} className="text-[#ffae3c]" />
              <h2 className="text-[13.5px] font-semibold text-white">Quick Actions</h2>
            </header>
            <nav className="divide-y divide-white/[0.04]">
              <QuickAction href="/admin/audits"   icon={<FileText size={13} />}  label="Review Audit Intake"  note={pending > 0 ? `${pending} pending` : 'Queue clear'} />
              <QuickAction href="/admin/leads"    icon={<Users size={13} />}     label="View Leads Pipeline"  note={`${summary.recentLeads} leads (7d)`} />
              <QuickAction href="/admin/clients"  icon={<Building2 size={13} />} label="Active Clients"       note={`${activeClients} total`} />
              <QuickAction href="/admin/launch-readiness" icon={<Rocket size={13} />} label="Launch Readiness" note="Pre-launch checks" />
              <QuickAction href="/admin/settings" icon={<Settings size={13} />}  label="Platform Settings"    note="Config & integrations" />
            </nav>
          </section>

          {/* Founder Focus */}
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <Activity size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Founder Focus</h2>
            </header>
            <div className="px-5 py-3.5 flex flex-col gap-2.5">
              <FocusItem
                label={pending > 0 ? `${pending} audit${pending !== 1 ? 's' : ''} need review` : 'Audit queue is clear'}
                href="/admin/audits"
                tone={pending > 0 ? 'warning' : 'success'}
              />
              {highPri > 0 && (
                <FocusItem
                  label={`${highPri} high-priority lead${highPri !== 1 ? 's' : ''} flagged`}
                  href="/admin/audits"
                  tone="danger"
                />
              )}
              {/* Onboarding delivery alerts — highest priority first. */}
              {onboarding.overdueTasks > 0 && (
                <FocusItem
                  label={`Review overdue onboarding tasks (${onboarding.overdueTasks}).`}
                  href="/admin/clients"
                  tone="danger"
                />
              )}
              {onboarding.blockedTasks > 0 && (
                <FocusItem
                  label={`Unblock client delivery tasks (${onboarding.blockedTasks}).`}
                  href="/admin/clients"
                  tone="danger"
                />
              )}
              {onboarding.dueSoonTasks > 0 && (
                <FocusItem
                  label={`Complete upcoming onboarding tasks (${onboarding.dueSoonTasks}).`}
                  href="/admin/clients"
                  tone="warning"
                />
              )}
              {onboarding.readyToGoLiveClients > 0 && (
                <FocusItem
                  label={`Review clients ready to go live (${onboarding.readyToGoLiveClients}).`}
                  href="/admin/clients"
                  tone="success"
                />
              )}
              {/* Revenue / payment warnings. */}
              {payments.overdue > 0 && (
                <FocusItem
                  label="Review overdue client payments."
                  href="/admin/clients"
                  tone="danger"
                />
              )}
              {payments.unpaid > 0 && (
                <FocusItem
                  label="Follow up on unpaid client accounts."
                  href="/admin/clients"
                  tone="warning"
                />
              )}
              <FocusItem
                label={relevanceReady ? 'Audit Qualifier Agent active' : 'Connect Relevance AI'}
                href={relevanceReady ? '/admin/relevance-ai' : '/admin/settings'}
                tone={relevanceReady ? 'success' : 'neutral'}
              />
              <FocusItem
                label={paypalReady ? 'PayPal configured — verification pending' : 'PayPal verification is not connected yet.'}
                href="/admin/settings"
                tone={paypalReady ? 'success' : 'neutral'}
              />
            </div>
          </section>
        </div>
      </div>

      {/* ── Revenue Command Center (compact strip) ───────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0">
            <TrendingUp size={13} className="text-[#6a6a6e] shrink-0" />
            <h2 className="text-[13.5px] font-semibold text-white">Revenue Command Center</h2>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full
                             border border-[#ffae3c]/30 bg-[#ffae3c]/[0.08] text-[#ffae3c] shrink-0">
              Estimated
            </span>
            <span className="text-[11px] text-[#6a6a6e] hidden sm:inline truncate">
              {paypalReady ? (
                'PayPal configured — payment verification pending'
              ) : (
                <>
                  No verified revenue yet —{' '}
                  <Link href="/admin/settings" className="text-[#ffae3c]/80 hover:text-[#ffae3c] transition-colors">
                    Connect PayPal
                  </Link>
                  {' '}or add real client plans to see revenue
                </>
              )}
            </span>
          </div>
        </header>
        <div className="px-4 py-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <RevenueCard label="MRR"               value={fmtUSD(mrr)}           sublabel="Monthly recurring"  tone="orange"  />
          <RevenueCard label="ARR"               value={fmtUSD(arr)}           sublabel="MRR × 12"           tone="orange"  />
          <RevenueCard label="Setup Revenue"     value={fmtUSD(setupRevenue)}  sublabel="One-time fees"      tone="neutral" />
          <RevenueCard label="Revenue This Month" value={fmtUSD(mrr)}          sublabel="Recurring only"     tone="neutral" />
          <RevenueCard label="Proj. 12-Month"    value={fmtUSD(projected12mo)} sublabel="ARR + setup"        tone="info"    />
          <RevenueCard label="Avg / Client"      value={fmtUSD(avgMonthly)}    sublabel={`${activeClients} active`} tone="info" />
        </div>
      </section>

      {/* ── Payment Tracking (manual — not PayPal-verified) ───────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Wallet size={13} className="text-[#6a6a6e] shrink-0" />
            <h2 className="text-[13.5px] font-semibold text-white">Payment Tracking</h2>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full
                             border border-white/[0.12] bg-white/[0.04] text-[#9a9a9d] shrink-0">
              Manual
            </span>
          </div>
          <Link
            href="/admin/clients"
            className="text-[12px] text-[#ffae3c] hover:text-white inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            Manage <ArrowRight size={11} />
          </Link>
        </header>
        {payments.tracked === 0 ? (
          <div className="px-5 py-5 text-[12.5px] text-[#9a9a9d]">
            Payment tracking will appear after clients are added.
          </div>
        ) : (
          <div className="px-4 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <RevenueCard label="Paid Clients"     value={String(payments.paid)}    sublabel="Recorded paid"  tone="neutral" />
            <RevenueCard label="Unpaid Clients"   value={String(payments.unpaid)}  sublabel="Unpaid / deposit" tone="orange" />
            <RevenueCard label="Overdue Payments" value={String(payments.overdue)} sublabel="Past due"       tone="neutral" />
            <RevenueCard label="Next Payment Due" value={String(payments.dueSoon)} sublabel="Within 7 days"  tone="info"    />
          </div>
        )}
      </section>

      {/* ── Onboarding Alerts (from admin_client_tasks) ───────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ClipboardList size={13} className="text-[#6a6a6e] shrink-0" />
            <h2 className="text-[13.5px] font-semibold text-white">Onboarding Alerts</h2>
          </div>
          <Link
            href="/admin/delivery"
            className="text-[12px] text-[#ffae3c] hover:text-white inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            Open Delivery Dashboard <ArrowRight size={11} />
          </Link>
        </header>

        {onboarding.migrationNeeded ? (
          <div className="px-5 py-5 text-[12.5px] text-[#9a9a9d]">
            Apply the onboarding tasks migration to enable deadline alerts.
          </div>
        ) : onboarding.clientsOnboarding === 0 && onboarding.totalOpenTasks === 0 ? (
          <div className="px-5 py-5 text-[12.5px] text-[#9a9a9d]">
            Onboarding alerts will appear after clients are added.
          </div>
        ) : (
          <>
            <div className="px-4 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <AlertStat label="Overdue Tasks"    value={onboarding.overdueTasks}         sub="Past due"      color={onboarding.overdueTasks > 0 ? '#ff5247' : '#6a6a6e'} />
              <AlertStat label="Due Soon"         value={onboarding.dueSoonTasks}         sub="Within 7 days" color={onboarding.dueSoonTasks > 0 ? '#ffae3c' : '#6a6a6e'} />
              <AlertStat label="Blocked"          value={onboarding.blockedTasks}         sub="Need attention" color={onboarding.blockedTasks > 0 ? '#ff5247' : '#6a6a6e'} />
              <AlertStat label="Ready To Go Live" value={onboarding.readyToGoLiveClients} sub="All tasks done" color={onboarding.readyToGoLiveClients > 0 ? '#22d093' : '#6a6a6e'} />
            </div>
            <div className="px-5 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6a6a6e] mb-2">Next Due Tasks</p>
              {onboarding.nextDueTasks.length === 0 ? (
                <p className="text-[12.5px] text-[#9a9a9d]">No onboarding deadlines need attention.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/[0.04]">
                  {onboarding.nextDueTasks.map((t) => {
                    const overdue = t.due_date !== null && t.due_date < todayStr
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[12.5px] text-white truncate">{t.client_business_name}</p>
                          <p className="text-[11.5px] text-[#9a9a9d] truncate">{t.title}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] tabular-nums" style={{ color: overdue ? '#ff5247' : '#9a9a9d' }}>
                            {overdue ? 'Overdue · ' : 'Due '}{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                          </span>
                          <MiniPill color={TASK_PRIORITY_TONE[t.priority]} label={t.priority} />
                          <MiniPill color={TASK_STATUS_TONE[t.status]} label={TASK_STATUS_LABEL[t.status]} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Client Suggestions (top priority across clients) ──────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Activity size={13} className="text-[#6a6a6e] shrink-0" />
            <h2 className="text-[13.5px] font-semibold text-white">Client Suggestions</h2>
          </div>
          <Link
            href="/admin/clients"
            className="text-[12px] text-[#ffae3c] hover:text-white inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            Open Clients <ArrowRight size={11} />
          </Link>
        </header>
        {clientSuggestions.items.length === 0 ? (
          <div className="px-5 py-5 text-[12.5px] text-[#9a9a9d]">
            {clientSuggestions.migrationNeeded
              ? 'Task-based suggestions will appear after onboarding tasks are enabled.'
              : 'No client suggestions need attention.'}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {clientSuggestions.items.map((s) => (
              <Link key={s.client_id} href="/admin/clients"
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.02] transition-colors group">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SUGGESTION_DOT[s.severity] ?? '#6a6a6e' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] text-white truncate group-hover:text-[#ffae3c] transition-colors">{s.business_name}</p>
                  <p className="text-[11.5px] text-[#9a9a9d] truncate">{s.recommendedAction}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap hidden sm:inline"
                  style={{ color: SUGGESTION_DOT[s.severity] ?? '#6a6a6e', borderColor: `${SUGGESTION_DOT[s.severity] ?? '#6a6a6e'}33`, background: `${SUGGESTION_DOT[s.severity] ?? '#6a6a6e'}12` }}>
                  {s.title}
                </span>
                <ArrowRight size={11} className="text-[#6a6a6e] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Service Health ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
        <header className="px-5 py-3 border-b border-white/[0.04]">
          <h2 className="text-[13.5px] font-semibold text-white">Service Health</h2>
          <p className="text-[11.5px] text-[#9a9a9d] mt-0.5">
            Environment variable presence — not a live connectivity ping.
          </p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.04]">
          <div className="flex flex-col divide-y divide-white/[0.04]">
            <HealthRow label="Supabase (database + auth)" present={summary.health.supabase}  required />
            <HealthRow label="Anthropic (AI chat)"        present={summary.health.anthropic} required />
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            <HealthRow label="PayPal (payments & billing)" present={summary.health.paypal} />
            <HealthRow label="Cal.com (booking)"  present={summary.health.calcom}  />
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            <HealthRow label="WhatsApp"           present={summary.health.whatsapp} />
            <HealthRow label="Relevance AI"       present={relevanceReady}          />
          </div>
        </div>
      </section>

    </div>
  )
}

// ── Revenue card (compact) ────────────────────────────────────────

function RevenueCard({ label, value, sublabel, tone }: {
  label: string; value: string; sublabel?: string; tone: 'orange' | 'neutral' | 'info'
}) {
  const styles = {
    orange:  { wrap: 'border-[#ff7a18]/20 bg-[#ff7a18]/[0.04]', val: 'text-[#ffae3c]' },
    neutral: { wrap: 'border-white/[0.06] bg-white/[0.02]',     val: 'text-white'     },
    info:    { wrap: 'border-[#3b9eff]/15 bg-[#3b9eff]/[0.03]', val: 'text-[#3b9eff]' },
  }
  const s = styles[tone]
  return (
    <div className={`rounded-xl border ${s.wrap} px-3.5 py-2.5`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6a6a6e] truncate">{label}</div>
      <div className={`text-[16px] font-bold tabular-nums mt-1 leading-none ${s.val}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-[#6a6a6e] mt-0.5 truncate">{sublabel}</div>}
    </div>
  )
}

// ── Quick action row ──────────────────────────────────────────────

function QuickAction({ href, icon, label, note }: {
  href: string; icon: React.ReactNode; label: string; note?: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors group"
    >
      <span className="text-[#6a6a6e] group-hover:text-[#ffae3c] transition-colors shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white group-hover:text-[#ffae3c] transition-colors">{label}</div>
        {note && <div className="text-[10.5px] text-[#6a6a6e]">{note}</div>}
      </div>
      <ArrowRight size={11} className="text-[#6a6a6e] group-hover:text-[#ffae3c] transition-colors shrink-0" />
    </Link>
  )
}

// ── Founder focus item ────────────────────────────────────────────

function FocusItem({ label, href, tone }: {
  label: string; href: string; tone: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  const colors = { success: '#22d093', warning: '#ffae3c', danger: '#ff8a7a', neutral: '#6a6a6e' }
  const c = colors[tone]
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: c, boxShadow: `0 0 5px ${c}55` }}
      />
      <span className="text-[12px] text-[#9a9a9d] group-hover:text-white transition-colors flex-1 leading-snug">
        {label}
      </span>
      <ArrowRight size={10} className="text-[#6a6a6e] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ── Health row ────────────────────────────────────────────────────

function HealthRow({ label, present, required }: {
  label: string; present: boolean; required?: boolean
}) {
  const color = present ? '#22d093' : required ? '#ff8a7a' : '#6a6a6e'
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {present ? (
          <CheckCircle2 size={12} className="text-[#22d093] shrink-0" />
        ) : (
          <AlertCircle size={12} className="shrink-0" style={{ color }} />
        )}
        <span className="text-[12.5px] text-white truncate">{label}</span>
        {required && !present && (
          <span className="text-[9px] text-[#ff8a7a] uppercase tracking-[0.1em] shrink-0">Required</span>
        )}
      </div>
      <span className="text-[11px] shrink-0 font-medium" style={{ color }}>
        {present ? 'OK' : required ? 'Missing' : 'Not set'}
      </span>
    </div>
  )
}
