import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAdminAuditMetrics, getAdminAuditTableRows, type AdminAuditStatus, type AdminAuditPriority } from '@/lib/data/admin-audits'
import { ArrowLeft, AlertTriangle, ExternalLink } from 'lucide-react'
import AuditActionsCell from './AuditActionsCell'

export const metadata = { title: 'Audits — Mission Control' }

// Lean Baseline: live Supabase reads from public.audit_submissions —
// the public intake queue. Action buttons (Mark reviewed / Convert /
// Archive) are wired to server actions in lib/actions/admin-audits.ts.
// Only founder_admin can reach this page.

const STATUS_LABEL: Record<AdminAuditStatus, { label: string; color: string }> = {
  new:        { label: 'New',         color: '#3b9eff' },
  in_review:  { label: 'In Review',   color: '#ffae3c' },
  qualified:  { label: 'Qualified',   color: '#22d093' },
  contacted:  { label: 'Contacted',   color: '#a07cff' },
  converted:  { label: 'Converted',   color: '#22d093' },
  archived:   { label: 'Archived',    color: '#6a6a6e' },
  unknown:    { label: 'Unknown',     color: '#6a6a6e' },
}

const PRIORITY_LABEL: Record<AdminAuditPriority, { label: string; color: string }> = {
  urgent:  { label: 'Urgent',  color: '#ff8a7a' },
  high:    { label: 'High',    color: '#ffae3c' },
  normal:  { label: 'Normal',  color: '#6a6a6e' },
  low:     { label: 'Low',     color: '#3b9eff' },
  unknown: { label: '—',       color: '#6a6a6e' },
}

export default async function AdminAuditsPage() {
  await requireAdmin({ path: '/admin/audits' })

  const [metrics, table] = await Promise.all([
    getAdminAuditMetrics(),
    getAdminAuditTableRows({ limit: 100 }),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Audit Intake</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Public audit and business-registration submissions, pulled live from{' '}
          <code className="font-mono text-[12px] px-1 py-0.5 rounded bg-white/[0.04]">public.audit_submissions</code>.
        </p>
      </div>

      {/* Metric summary */}
      {metrics.error ? (
        <div className="rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#ffae3c] shrink-0 mt-0.5" />
          <div className="text-[13.5px] text-[#ffae3c]">
            Audit metrics could not be loaded: {metrics.error}
            <div className="text-[12px] text-[#9a9a9d] mt-1">
              Apply <code className="font-mono">supabase/migrations/20260520120000_create_audit_submissions.sql</code> in Supabase and confirm the service role key is configured.
            </div>
          </div>
        </div>
      ) : (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total"          value={metrics.total}        tone="neutral" />
          <MetricCard label="New today"      value={metrics.newToday}     tone="success" />
          <MetricCard label="Pending"        value={metrics.pending}      tone="warning" />
          <MetricCard label="In review"      value={metrics.inReview}     tone="info"    />
          <MetricCard label="Converted"      value={metrics.completed}    tone="success" />
          <MetricCard label="High priority"  value={metrics.highPriority} tone="danger"  />
        </section>
      )}

      {/* Table / states */}
      {table.error ? (
        <div className="rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] p-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[#ffae3c] shrink-0 mt-0.5" />
          <div className="text-[13.5px] text-[#ffae3c]">
            Intake table unavailable: {table.error}
            <div className="text-[12px] text-[#9a9a9d] mt-1">
              Run <code className="font-mono">supabase/migrations/20260520120000_create_audit_submissions.sql</code> in Supabase.
            </div>
          </div>
        </div>
      ) : table.rows.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-10 text-center flex flex-col items-center gap-3">
          <div className="text-[15px] text-white">No audit submissions yet</div>
          <p className="text-[13px] text-[#9a9a9d] max-w-[460px]">
            When a prospect submits the public audit form at{' '}
            <Link href="/audit" className="text-[#ffae3c] hover:underline">/audit</Link> or{' '}
            <Link href="/register-business" className="text-[#ffae3c] hover:underline">/register-business</Link>,
            it will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-x-auto">
          <table className="w-full text-[13.5px] min-w-[1080px]">
            <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
              <tr>
                <th className="text-left px-5 py-3">Business</th>
                <th className="text-left px-5 py-3">Industry</th>
                <th className="text-left px-5 py-3">Location</th>
                <th className="text-left px-5 py-3">Website</th>
                <th className="text-left px-5 py-3">Plan</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Priority</th>
                <th className="text-right px-5 py-3">Score</th>
                <th className="text-left px-5 py-3">Source</th>
                <th className="text-right px-5 py-3">Submitted</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => {
                const status   = STATUS_LABEL[row.status]
                const priority = PRIORITY_LABEL[row.priority]
                const location = row.location ?? ([row.city, row.country].filter(Boolean).join(', ') || '—')
                return (
                  <tr key={row.id} className="border-t border-white/[0.04]">
                    <td className="px-5 py-3 text-white">
                      <div>{row.business_name}</div>
                      {row.contact_name && (
                        <div className="text-[11.5px] text-[#6a6a6e]">{row.contact_name}{row.email ? ` · ${row.email}` : ''}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[#9a9a9d]">{row.business_type ?? '—'}</td>
                    <td className="px-5 py-3 text-[#9a9a9d]">{location}</td>
                    <td className="px-5 py-3 text-[#9a9a9d] max-w-[220px] truncate">
                      {row.website_url ? (
                        <a href={row.website_url} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 hover:text-[#ffae3c] transition-colors">
                          {row.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink size={11} className="shrink-0" />
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-[#9a9a9d] capitalize">{row.recommended_plan ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
                        style={{ color: status.color, borderColor: `${status.color}40`, background: `${status.color}12` }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
                        style={{ color: priority.color, borderColor: `${priority.color}40`, background: `${priority.color}12` }}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-white">
                      {row.qualification_score === null ? '—' : row.qualification_score}
                    </td>
                    <td className="px-5 py-3 text-[#9a9a9d] capitalize">{row.source}</td>
                    <td className="px-5 py-3 text-right text-[12px] text-[#6a6a6e]">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <AuditActionsCell submissionId={row.id} status={row.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {table.total > table.rows.length && (
            <div className="px-5 py-3 text-[11.5px] text-[#6a6a6e] border-t border-white/[0.04] text-center">
              Showing {table.rows.length} of {table.total} submissions. Pagination coming in a future pass.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Metric summary card ───────────────────────────────────────────

const METRIC_TONE = {
  neutral: 'border-white/[0.08] bg-[#0f1012]/60      text-white',
  success: 'border-[#22d093]/25 bg-[#22d093]/[0.05]  text-[#22d093]',
  warning: 'border-[#ffae3c]/25 bg-[#ffae3c]/[0.05]  text-[#ffae3c]',
  info:    'border-[#3b9eff]/25 bg-[#3b9eff]/[0.05]  text-[#3b9eff]',
  danger:  'border-[#ff8a7a]/25 bg-[#ff8a7a]/[0.05]  text-[#ff8a7a]',
} as const

function MetricCard({ label, value, tone }: { label: string; value: number; tone: keyof typeof METRIC_TONE }) {
  return (
    <div className={`rounded-2xl border p-4 ${METRIC_TONE[tone]}`}>
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</div>
      <div className="text-[22px] font-semibold mt-1 text-white">{value}</div>
    </div>
  )
}
