import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  getAdminAuditMetrics,
  getLatestAdminAuditSubmissions,
  type AdminAuditRow,
} from '@/lib/data/admin-audits'
import { getAdminMissionControlSummary } from '@/lib/data/admin-mission-control'
import { MOCK_BUSINESSES } from '@/lib/data/mock-businesses'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import StatusPill from '@/components/admin/ui/StatusPill'
import PlanPill from '@/components/admin/ui/PlanPill'
import {
  CheckCircle2, AlertCircle, ArrowRight, TrendingUp, Zap,
  FileText, Users, Building2, Settings, Activity,
} from 'lucide-react'

export const metadata = { title: 'Mission Control — Helios AI Admin' }

const PLAN_MONTHLY: Record<string, number> = { starter: 149, pro: 399, scale: 999, free: 0 }
const PLAN_SETUP:   Record<string, number> = { starter: 997, pro: 2500, scale: 5000, free: 0 }

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `$${n}`
}

export default async function AdminMissionControlPage() {
  const session = await requireAdmin({ path: '/admin/mission-control' })

  const [auditMetrics, latestAudits, summary] = await Promise.all([
    getAdminAuditMetrics(),
    getLatestAdminAuditSubmissions(6),
    getAdminMissionControlSummary(),
  ])

  const firstName      = (session.fullName ?? session.email).split(' ')[0]
  const hasCritical    = !!auditMetrics.error || !!summary.error
  const stripeReady    = !!process.env.STRIPE_SECRET_KEY
  const relevanceReady = !!process.env.RELEVANCE_API_KEY

  const mrr          = MOCK_BUSINESSES.reduce((s, b) => s + (PLAN_MONTHLY[b.plan] ?? 0), 0)
  const arr          = mrr * 12
  const setupRevenue = MOCK_BUSINESSES.reduce((s, b) => s + (PLAN_SETUP[b.plan]   ?? 0), 0)
  const avgMonthly   = MOCK_BUSINESSES.length > 0 ? Math.round(mrr / MOCK_BUSINESSES.length) : 0

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
          value={summary.activeClients}
          tone="info"
          sublabel="Live from Supabase"
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
          ) : latestAudits.rows.length === 0 ? (
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] min-w-[580px]">
                <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                  <tr>
                    <th className="text-left px-4 py-2.5">Business</th>
                    <th className="text-left px-4 py-2.5">Industry</th>
                    <th className="text-left px-4 py-2.5">Plan</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    <th className="text-right px-4 py-2.5">Score</th>
                    <th className="text-right px-4 py-2.5">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {latestAudits.rows.map((a: AdminAuditRow) => (
                    <tr key={a.id} className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="text-white font-medium">{a.business_name}</div>
                        {a.contact_name && (
                          <div className="text-[10.5px] text-[#6a6a6e] mt-0.5">{a.contact_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#9a9a9d]">{a.business_type ?? '—'}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <QuickAction href="/admin/clients"  icon={<Building2 size={13} />} label="Active Clients"       note={`${summary.activeClients} total`} />
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
              <FocusItem
                label={relevanceReady ? 'Audit Qualifier Agent active' : 'Connect Relevance AI'}
                href={relevanceReady ? '/admin/relevance-ai' : '/admin/settings'}
                tone={relevanceReady ? 'success' : 'neutral'}
              />
              <FocusItem
                label={stripeReady ? 'Stripe billing connected' : 'Connect Stripe for live revenue'}
                href="/admin/settings"
                tone={stripeReady ? 'success' : 'neutral'}
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
              {stripeReady ? 'Live' : 'Estimated'}
            </span>
            {!stripeReady && (
              <span className="text-[11px] text-[#6a6a6e] hidden sm:inline truncate">
                Estimated from active plans —{' '}
                <Link href="/admin/settings" className="text-[#ffae3c]/80 hover:text-[#ffae3c] transition-colors">
                  Connect Stripe
                </Link>
                {' '}to verify live revenue
              </span>
            )}
          </div>
        </header>
        <div className="px-4 py-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <RevenueCard label="MRR"               value={fmtUSD(mrr)}          sublabel="Monthly recurring"   tone="orange"  />
          <RevenueCard label="ARR"               value={fmtUSD(arr)}          sublabel="MRR × 12"            tone="orange"  />
          <RevenueCard label="Setup Revenue"     value={fmtUSD(setupRevenue)} sublabel="One-time fees"       tone="neutral" />
          <RevenueCard label="Revenue This Month" value={fmtUSD(mrr)}         sublabel="Recurring only"      tone="neutral" />
          <RevenueCard label="Proj. 12-Month"    value={fmtUSD(arr)}          sublabel="From current MRR"    tone="info"    />
          <RevenueCard label="Avg / Client"      value={fmtUSD(avgMonthly)}   sublabel={`${MOCK_BUSINESSES.length} active`} tone="info" />
        </div>
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
            <HealthRow label="Stripe (billing)"   present={summary.health.stripe}  />
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
