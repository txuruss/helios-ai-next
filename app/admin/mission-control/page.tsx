import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import AdminPreviewCard from '@/components/admin/AdminPreviewCard'
import { MOCK_ADMIN_KPIS, MOCK_ADMIN_CONTENT, MOCK_ADMIN_SOCIAL, MOCK_ADMIN_NOTIFICATIONS, MOCK_ADMIN_REVENUE, MOCK_ADMIN_CALLS } from '@/lib/data/mock-admin'
import type { AdminKpi } from '@/lib/data/mock-admin'
import { MOCK_BUSINESSES } from '@/lib/data/mock-businesses'
import { MOCK_PIPELINE, MOCK_DELIVERY, MOCK_OUTREACH, MOCK_AGENT_RUNS } from '@/lib/data/mock-team'
import { getAdminAuditMetrics, getLatestAdminAuditSubmissions, type AdminAuditRow, type AdminAuditStatus } from '@/lib/data/admin-audits'
import { CircleAlert, CircleCheck, AlertTriangle, Calendar, Building2, Send, Bot, FileText, Share2, PackageCheck } from 'lucide-react'

export const metadata = { title: 'Mission Control — Helios AI Admin' }

export default async function AdminMissionControlPage() {
  const session = await requireAdmin({ path: '/admin/mission-control' })

  // ── Pass 33: real audit data ────────────────────────────────────
  // Audit-related KPIs and the Audit Inbox panel now read from the
  // production `business_audits` table. Everything else on this page
  // remains mock — see lib/data/mock-admin.ts.
  const [auditMetrics, latestAudits] = await Promise.all([
    getAdminAuditMetrics(),
    getLatestAdminAuditSubmissions(4),
  ])

  const topDeals       = MOCK_PIPELINE.slice(0, 4)
  const activeProjects = MOCK_DELIVERY.slice(0, 3)
  const recentAgents   = MOCK_AGENT_RUNS.slice(0, 3)
  const upcomingCalls  = MOCK_ADMIN_CALLS.filter((c) => c.status === 'upcoming').slice(0, 3)
  const recentContent  = MOCK_ADMIN_CONTENT.filter((c) => c.stage !== 'published').slice(0, 3)
  const recentSocial   = MOCK_ADMIN_SOCIAL.slice(0, 3)
  const alerts         = MOCK_ADMIN_NOTIFICATIONS.filter((n) => !n.acknowledged).slice(0, 4)
  const currentMonth   = MOCK_ADMIN_REVENUE[MOCK_ADMIN_REVENUE.length - 1]
  const priorMonth     = MOCK_ADMIN_REVENUE[MOCK_ADMIN_REVENUE.length - 2]

  // Inject the live "new audits today" value into the KPI grid without
  // touching the other mock cards.
  const kpis: AdminKpi[] = MOCK_ADMIN_KPIS.map((kpi) =>
    kpi.key === 'audits_today'
      ? {
          ...kpi,
          value: String(auditMetrics.newToday),
          delta: auditMetrics.error ? 'audit table unavailable' : `${auditMetrics.total} total · ${auditMetrics.pending} pending`,
          tone:  auditMetrics.error ? 'warning' : (auditMetrics.newToday > 0 ? 'success' : 'neutral'),
        }
      : kpi,
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">Founder Command Center</span>
        <h1 className="text-[24px] font-semibold tracking-tight text-white">
          Welcome back, {(session.fullName ?? session.email).split(' ')[0]}.
        </h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          A live snapshot of every customer-facing system across Helios AI. Mock data shown until live wiring lands.
        </p>
      </header>

      {/* 1. Overview KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
      </section>

      {/* 2 + 3. Audit inbox + Lead pipeline */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminPreviewCard
          title="Audit Inbox"
          subtitle={auditMetrics.error ? 'Audit table unavailable' : `${auditMetrics.total} total · ${auditMetrics.pending} pending`}
          href="/admin/audits"
          hrefLabel="Open audits"
          legacyHref="/dashboard/audits"
          legacyLabel="Legacy audits"
        >
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-[0.08em] text-[#6a6a6e]">
              <tr>
                <th className="text-left px-5 py-2.5">Business</th>
                <th className="text-left px-5 py-2.5">Industry</th>
                <th className="text-left px-5 py-2.5">Status</th>
                <th className="text-right px-5 py-2.5">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {latestAudits.error ? (
                <tr><td colSpan={4} className="px-5 py-4 text-[13px] text-[#ff8a7a]">{latestAudits.error}</td></tr>
              ) : latestAudits.rows.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-4 text-[13px] text-[#6a6a6e]">No audit submissions yet.</td></tr>
              ) : latestAudits.rows.map((a: AdminAuditRow) => (
                <tr key={a.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-2.5 text-white truncate">{a.business_name}</td>
                  <td className="px-5 py-2.5 text-[#9a9a9d]">{a.business_type ?? '—'}</td>
                  <td className="px-5 py-2.5"><StatusBadge label={a.status} tone={auditStatusTone(a.status)} /></td>
                  <td className="px-5 py-2.5 text-right text-[11.5px] text-[#6a6a6e]">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminPreviewCard>

        <AdminPreviewCard
          title="Lead Pipeline"
          subtitle="Top open deals by stage"
          href="/admin/leads"
          hrefLabel="Open leads"
          legacyHref="/dashboard/leads"
          legacyLabel="Legacy leads"
        >
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-[0.08em] text-[#6a6a6e]">
              <tr><th className="text-left px-5 py-2.5">Business</th><th className="text-left px-5 py-2.5">Stage</th><th className="text-right px-5 py-2.5">Value</th></tr>
            </thead>
            <tbody>
              {topDeals.map((d) => (
                <tr key={d.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-2.5 text-white truncate">{d.business}</td>
                  <td className="px-5 py-2.5"><StatusBadge label={d.stage} tone={dealTone(d.stage)} /></td>
                  <td className="px-5 py-2.5 text-right font-mono text-white">${d.value_usd.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminPreviewCard>
      </section>

      {/* 4 + 5. Clients + Outreach */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminPreviewCard
          title="Client Management"
          subtitle="Active clients by plan"
          href="/admin/clients"
          hrefLabel="Open clients"
        >
          <ul className="divide-y divide-white/[0.04]">
            {MOCK_BUSINESSES.slice(0, 4).map((b) => (
              <li key={b.id} className="flex items-center justify-between px-5 py-2.5 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={13} className="text-[#6a6a6e] shrink-0" />
                  <span className="text-[13.5px] text-white truncate">{b.name}</span>
                </div>
                <span className="text-[11px] text-[#9a9a9d] capitalize shrink-0">{b.plan}</span>
              </li>
            ))}
          </ul>
        </AdminPreviewCard>

        <AdminPreviewCard
          title="Outreach"
          subtitle="Active campaigns"
          href="/admin/outreach"
          hrefLabel="Open outreach"
        >
          <ul className="divide-y divide-white/[0.04]">
            {MOCK_OUTREACH.slice(0, 3).map((o) => {
              const replyRate = o.sent ? Math.round((o.replied / o.sent) * 1000) / 10 : 0
              return (
                <li key={o.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Send size={13} className="text-[#6a6a6e] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13.5px] text-white truncate">{o.campaign}</div>
                      <div className="text-[11px] text-[#6a6a6e] capitalize">{o.channel}</div>
                    </div>
                  </div>
                  <span className="text-[11.5px] font-mono text-[#9a9a9d] shrink-0">{replyRate}% reply</span>
                </li>
              )
            })}
          </ul>
        </AdminPreviewCard>
      </section>

      {/* 6 + 7. Relevance AI + Content / Social */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminPreviewCard
          title="Relevance AI Activity"
          subtitle="Most recent agent runs"
          href="/admin/relevance-ai"
          hrefLabel="Open agents"
          legacyHref="/dashboard/agents"
          legacyLabel="Legacy agents"
        >
          <ul className="divide-y divide-white/[0.04]">
            {recentAgents.map((r) => (
              <li key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot size={13} className="text-[#6a6a6e] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13.5px] text-white truncate">{r.agent}</div>
                    <div className="text-[11px] text-[#6a6a6e] truncate">{r.business}</div>
                  </div>
                </div>
                <StatusBadge label={r.status} tone={runTone(r.status)} />
              </li>
            ))}
          </ul>
        </AdminPreviewCard>

        <AdminPreviewCard
          title="Content & Social"
          subtitle="In-flight pieces and posts"
          href="/admin/content"
          hrefLabel="Open content"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.04]">
            <ul className="divide-y divide-white/[0.04]">
              {recentContent.map((c) => (
                <li key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={13} className="text-[#6a6a6e] shrink-0" />
                    <span className="text-[13px] text-white truncate">{c.title}</span>
                  </div>
                  <StatusBadge label={c.stage} tone={contentTone(c.stage)} />
                </li>
              ))}
            </ul>
            <ul className="divide-y divide-white/[0.04]">
              {recentSocial.map((s) => (
                <li key={s.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Share2 size={13} className="text-[#6a6a6e] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] text-white truncate">{s.caption}</div>
                      <div className="text-[10.5px] text-[#6a6a6e] capitalize">{s.channel}</div>
                    </div>
                  </div>
                  <StatusBadge label={s.status} tone={socialTone(s.status)} />
                </li>
              ))}
            </ul>
          </div>
        </AdminPreviewCard>
      </section>

      {/* 8 + 9. Bookings + Notifications */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminPreviewCard
          title="Bookings & Calls"
          subtitle="Upcoming strategy calls"
          href="/admin/bookings"
          hrefLabel="Open bookings"
          legacyHref="/dashboard/bookings"
          legacyLabel="Legacy bookings"
        >
          <ul className="divide-y divide-white/[0.04]">
            {upcomingCalls.map((c) => (
              <li key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar size={13} className="text-[#6a6a6e] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13.5px] text-white truncate">{c.contact} — {c.business}</div>
                    <div className="text-[11px] text-[#6a6a6e] capitalize">{c.channel}</div>
                  </div>
                </div>
                <span className="text-[11.5px] text-[#9a9a9d] shrink-0">{new Date(c.scheduled_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </AdminPreviewCard>

        <AdminPreviewCard
          title="Notifications"
          subtitle="Alerts requiring founder attention"
          href="/admin/notifications"
          hrefLabel="Open notifications"
        >
          <ul className="divide-y divide-white/[0.04]">
            {alerts.map((n) => {
              const Icon = n.level === 'critical' ? CircleAlert : n.level === 'warning' ? AlertTriangle : CircleCheck
              const color = n.level === 'critical' ? 'text-[#ff8a7a]' : n.level === 'warning' ? 'text-[#ffae3c]' : 'text-[#22d093]'
              return (
                <li key={n.id} className="px-5 py-2.5 flex items-start gap-2.5">
                  <Icon size={14} className={`${color} shrink-0 mt-0.5`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white">{n.message}</div>
                    <div className="text-[11px] text-[#6a6a6e] mt-0.5">{n.source} · {new Date(n.created_at).toLocaleDateString()}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </AdminPreviewCard>
      </section>

      {/* 10. Revenue Snapshot + Delivery */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminPreviewCard
          title="Revenue Snapshot"
          subtitle="Setup + monthly retainer this month"
          href="/admin/revenue"
          hrefLabel="Open revenue"
        >
          <div className="px-5 py-4 flex flex-col gap-3">
            <RevenueRow label="Setup revenue (MTD)" value={`$${currentMonth.setup_usd.toLocaleString()}`} delta={`vs $${priorMonth.setup_usd.toLocaleString()} prior`} />
            <RevenueRow label="Monthly retainer (MTD)" value={`$${currentMonth.monthly_usd.toLocaleString()}`} delta={`vs $${priorMonth.monthly_usd.toLocaleString()} prior`} />
            <RevenueRow label="Active subscriptions" value={String(currentMonth.active_subs)} delta={`+${currentMonth.active_subs - priorMonth.active_subs} vs prior`} />
          </div>
        </AdminPreviewCard>

        <AdminPreviewCard
          title="Delivery"
          subtitle="Active client builds and launches"
          href="/admin/delivery"
          hrefLabel="Open delivery"
          legacyHref="/dashboard/delivery"
          legacyLabel="Legacy delivery"
        >
          <ul className="divide-y divide-white/[0.04]">
            {activeProjects.map((p) => (
              <li key={p.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <PackageCheck size={13} className="text-[#6a6a6e] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13.5px] text-white truncate">{p.business}</div>
                    <div className="text-[11px] text-[#6a6a6e] capitalize">{p.stage}</div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#ffae3c] shrink-0">{p.progress}%</span>
              </li>
            ))}
          </ul>
        </AdminPreviewCard>
      </section>

      <footer className="text-[11px] text-[#6a6a6e] text-center pt-2">
        Mock data scaffolding · live wiring lands in a follow-up pass. Use the {' '}
        <Link href="/dashboard" className="text-[#ffae3c] hover:underline">legacy dashboard</Link> for working data today.
      </footer>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────

const TONE_STYLES = {
  neutral: { wrap: 'border-white/[0.08] bg-[#0f1012]/60',                       label: 'text-[#6a6a6e]' },
  success: { wrap: 'border-[#22d093]/25 bg-[#22d093]/[0.05]',                   label: 'text-[#22d093]' },
  warning: { wrap: 'border-[#ffae3c]/25 bg-[#ffae3c]/[0.05]',                   label: 'text-[#ffae3c]' },
  danger:  { wrap: 'border-[#ff8a7a]/25 bg-[#ff8a7a]/[0.05]',                   label: 'text-[#ff8a7a]' },
} as const

function KpiCard({ kpi }: { kpi: AdminKpi }) {
  const t = TONE_STYLES[kpi.tone]
  return (
    <div className={`rounded-2xl border p-4 ${t.wrap}`}>
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-[#6a6a6e]">{kpi.label}</div>
      <div className="text-[22px] font-semibold mt-1 text-white">{kpi.value}</div>
      {kpi.delta && <div className={`text-[11px] mt-0.5 ${t.label}`}>{kpi.delta}</div>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const BADGE_COLOR: Record<BadgeTone, string> = {
  success: '#22d093',
  warning: '#ffae3c',
  danger:  '#ff8a7a',
  info:    '#3b9eff',
  neutral: '#6a6a6e',
}

function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const c = BADGE_COLOR[tone]
  return (
    <span className="inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full border capitalize"
      style={{ color: c, borderColor: `${c}40`, background: `${c}12` }}>
      {label.replaceAll('_', ' ')}
    </span>
  )
}

function auditStatusTone(status: AdminAuditStatus): BadgeTone {
  if (status === 'new')        return 'info'
  if (status === 'in_review')  return 'warning'
  if (status === 'qualified')  return 'success'
  if (status === 'contacted')  return 'info'
  if (status === 'converted')  return 'success'
  if (status === 'archived')   return 'neutral'
  return 'neutral'
}

function dealTone(stage: string): BadgeTone {
  if (stage === 'won')                   return 'success'
  if (stage === 'lost')                  return 'danger'
  if (stage === 'qualified')             return 'info'
  if (stage === 'proposal')              return 'warning'
  if (stage === 'audit_sent')            return 'warning'
  return 'neutral'
}

function runTone(status: string): BadgeTone {
  if (status === 'complete') return 'success'
  if (status === 'failed')   return 'danger'
  if (status === 'running')  return 'info'
  return 'neutral'
}

function contentTone(stage: string): BadgeTone {
  if (stage === 'published') return 'success'
  if (stage === 'scheduled') return 'info'
  if (stage === 'review')    return 'warning'
  return 'neutral'
}

function socialTone(status: string): BadgeTone {
  if (status === 'posted')    return 'success'
  if (status === 'scheduled') return 'info'
  return 'neutral'
}

// ── Revenue row ───────────────────────────────────────────────────

function RevenueRow({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[12px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</span>
      <div className="text-right">
        <div className="text-[16px] font-semibold text-white">{value}</div>
        <div className="text-[11px] text-[#6a6a6e]">{delta}</div>
      </div>
    </div>
  )
}
