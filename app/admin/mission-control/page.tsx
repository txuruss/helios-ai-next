import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  getAdminAuditMetrics,
  getLatestAdminAuditSubmissions,
  type AdminAuditRow,
  type AdminAuditStatus,
} from '@/lib/data/admin-audits'
import { getAdminMissionControlSummary } from '@/lib/data/admin-mission-control'
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'

export const metadata = { title: 'Mission Control — Helios AI Admin' }

// Lean Baseline: founder-only command center. Only practical, live
// data is shown — every mock-data preview panel from the prior
// scaffolding pass is gone. The remaining cards:
//   • Audit Intake summary (live)
//   • Latest audit submissions table (live)
//   • Active clients / Recent leads / Recent bookings (live)
//   • Service health (env-presence flags only)

export default async function AdminMissionControlPage() {
  const session = await requireAdmin({ path: '/admin/mission-control' })

  const [auditMetrics, latestAudits, summary] = await Promise.all([
    getAdminAuditMetrics(),
    getLatestAdminAuditSubmissions(6),
    getAdminMissionControlSummary(),
  ])

  const firstName = (session.fullName ?? session.email).split(' ')[0]
  const hasCritical = !!auditMetrics.error || !!summary.error
  const newAuditsCount = auditMetrics.newToday
  const pendingCount = auditMetrics.pending
  const highPriorityCount = auditMetrics.highPriority

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">
          Founder Command Center
        </span>
        <h1 className="text-[24px] font-semibold tracking-tight text-white">
          Welcome back, {firstName}.
        </h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Live overview of audit intake, clients, leads, and platform health.
        </p>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="New audits today" value={newAuditsCount} tone={newAuditsCount > 0 ? 'success' : 'neutral'} />
        <KpiCard label="Pending audits"   value={pendingCount}   tone={pendingCount   > 0 ? 'warning' : 'neutral'} />
        <KpiCard label="High priority"    value={highPriorityCount} tone={highPriorityCount > 0 ? 'danger' : 'neutral'} />
        <KpiCard label="Active clients"   value={summary.activeClients}  tone="info" />
        <KpiCard label="Leads (7d)"       value={summary.recentLeads}    tone="info" />
        <KpiCard label="Bookings (7d)"    value={summary.recentBookings} tone="info" />
      </section>

      {hasCritical && (
        <div className="rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-[#ffae3c] shrink-0 mt-0.5" />
          <div className="text-[13.5px] text-[#ffae3c]">
            {auditMetrics.error && <div>Audit metrics: {auditMetrics.error}</div>}
            {summary.error      && <div>Mission Control summary: {summary.error}</div>}
            <div className="text-[12px] text-[#9a9a9d] mt-1">
              Confirm the Supabase service-role key is set and required migrations are applied.
            </div>
          </div>
        </div>
      )}

      {/* Latest audit submissions */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Latest audit submissions</h2>
            <p className="text-[12px] text-[#9a9a9d] mt-0.5">
              {auditMetrics.error
                ? 'Intake table unavailable.'
                : `${auditMetrics.total} total · ${auditMetrics.pending} pending review.`}
            </p>
          </div>
          <Link
            href="/admin/audits"
            className="text-[12.5px] text-[#ffae3c] hover:text-white inline-flex items-center gap-1 transition-colors"
          >
            Open audits <ArrowRight size={12} />
          </Link>
        </header>

        {latestAudits.error ? (
          <div className="px-5 py-6 text-[13px] text-[#ff8a7a]">{latestAudits.error}</div>
        ) : latestAudits.rows.length === 0 ? (
          <div className="px-5 py-6 text-[13px] text-[#6a6a6e]">
            No audit submissions yet. New intake from{' '}
            <Link href="/audit" className="text-[#ffae3c] hover:underline">/audit</Link> and{' '}
            <Link href="/register-business" className="text-[#ffae3c] hover:underline">/register-business</Link>{' '}
            will show up here.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.02] text-[10.5px] uppercase tracking-[0.08em] text-[#6a6a6e]">
              <tr>
                <th className="text-left px-5 py-2.5">Business</th>
                <th className="text-left px-5 py-2.5">Industry</th>
                <th className="text-left px-5 py-2.5">Plan</th>
                <th className="text-left px-5 py-2.5">Status</th>
                <th className="text-right px-5 py-2.5">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {latestAudits.rows.map((a: AdminAuditRow) => (
                <tr key={a.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-2.5 text-white truncate">
                    <div>{a.business_name}</div>
                    {a.contact_name && (
                      <div className="text-[11px] text-[#6a6a6e]">{a.contact_name}</div>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-[#9a9a9d]">{a.business_type ?? '—'}</td>
                  <td className="px-5 py-2.5 text-[#9a9a9d] capitalize">{a.recommended_plan ?? '—'}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-5 py-2.5 text-right text-[11.5px] text-[#6a6a6e]">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Service health */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <header className="px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-[15px] font-semibold text-white">Service health</h2>
          <p className="text-[12px] text-[#9a9a9d] mt-0.5">
            Environment variables configured for each integration. Not a live ping.
          </p>
        </header>
        <ul className="divide-y divide-white/[0.04]">
          <HealthRow label="Supabase (database + auth)" present={summary.health.supabase}  required />
          <HealthRow label="Anthropic (AI chat)"        present={summary.health.anthropic} required />
          <HealthRow label="Cal.com (booking)"          present={summary.health.calcom} />
          <HealthRow label="WhatsApp"                   present={summary.health.whatsapp} />
          <HealthRow label="Stripe"                     present={summary.health.stripe} />
        </ul>
      </section>

      <footer className="text-[11px] text-[#6a6a6e] text-center pt-2">
        Lean Baseline · Founder admin · See <Link href="/admin/audits" className="text-[#ffae3c] hover:underline">audit intake</Link> for actions.
      </footer>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────

const TONE_STYLES = {
  neutral: { wrap: 'border-white/[0.08] bg-[#0f1012]/60',     label: 'text-[#6a6a6e]' },
  success: { wrap: 'border-[#22d093]/25 bg-[#22d093]/[0.05]', label: 'text-[#22d093]' },
  warning: { wrap: 'border-[#ffae3c]/25 bg-[#ffae3c]/[0.05]', label: 'text-[#ffae3c]' },
  danger:  { wrap: 'border-[#ff8a7a]/25 bg-[#ff8a7a]/[0.05]', label: 'text-[#ff8a7a]' },
  info:    { wrap: 'border-[#3b9eff]/25 bg-[#3b9eff]/[0.05]', label: 'text-[#3b9eff]' },
} as const

type Tone = keyof typeof TONE_STYLES

function KpiCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const t = TONE_STYLES[tone]
  return (
    <div className={`rounded-2xl border p-4 ${t.wrap}`}>
      <div className={`text-[10.5px] uppercase tracking-[0.08em] ${t.label}`}>{label}</div>
      <div className="text-[22px] font-semibold mt-1 text-white">{value}</div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────

const STATUS_COLOR: Record<AdminAuditStatus, string> = {
  new:        '#3b9eff',
  in_review:  '#ffae3c',
  qualified:  '#22d093',
  contacted:  '#a07cff',
  converted:  '#22d093',
  archived:   '#6a6a6e',
  unknown:    '#6a6a6e',
}

function StatusBadge({ status }: { status: AdminAuditStatus }) {
  const c = STATUS_COLOR[status]
  return (
    <span
      className="inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full border capitalize"
      style={{ color: c, borderColor: `${c}40`, background: `${c}12` }}
    >
      {status.replaceAll('_', ' ')}
    </span>
  )
}

// ── Health row ────────────────────────────────────────────────────

function HealthRow({
  label,
  present,
  required,
}: {
  label:    string
  present:  boolean
  required?: boolean
}) {
  const ok = present
  const isBlocking = required && !present
  const color = ok ? '#22d093' : isBlocking ? '#ff8a7a' : '#6a6a6e'
  return (
    <li className="px-5 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {ok ? (
          <CheckCircle2 size={14} className="text-[#22d093] shrink-0" />
        ) : (
          <AlertCircle size={14} className="shrink-0" style={{ color }} />
        )}
        <span className="text-[13.5px] text-white truncate">{label}</span>
        {required && <span className="text-[10.5px] text-[#6a6a6e] uppercase tracking-[0.08em]">Required</span>}
      </div>
      <span className="text-[11.5px]" style={{ color }}>
        {ok ? 'Configured' : isBlocking ? 'Missing — required' : 'Not configured'}
      </span>
    </li>
  )
}

