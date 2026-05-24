import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAdminAuditMetrics, getAdminAuditTableRows } from '@/lib/data/admin-audits'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import AuditTableClient from './AuditTableClient'
import { ArrowLeft, AlertTriangle, Database, FileSearch } from 'lucide-react'

export const metadata = { title: 'Audits — Mission Control' }

export default async function AdminAuditsPage() {
  await requireAdmin({ path: '/admin/audits' })

  const [metrics, table] = await Promise.all([
    getAdminAuditMetrics(),
    getAdminAuditTableRows({ limit: 100 }),
  ])

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-1.5">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white">Audit Intake</h1>
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                          px-2.5 py-1 rounded-full border border-[#22d093]/30 bg-[#22d093]/[0.07] text-[#22d093]">
            <Database size={10} />
            Live Data
          </div>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Public audit and business-registration submissions from{' '}
          <code className="font-mono text-[12px] px-1.5 py-0.5 rounded bg-white/[0.05] text-[#9a9a9d]">
            public.audit_submissions
          </code>
        </p>
      </header>

      {/* ── Metric error banner ──────────────────────────────────── */}
      {metrics.error && (
        <div className="rounded-2xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#ffae3c] shrink-0 mt-0.5" />
          <div className="text-[13.5px] text-[#ffae3c]">
            Audit metrics could not be loaded: {metrics.error}
            <div className="text-[12px] text-[#9a9a9d] mt-1">
              Apply{' '}
              <code className="font-mono text-[11.5px]">
                supabase/migrations/20260520120000_create_audit_submissions.sql
              </code>{' '}
              in Supabase and confirm the service role key is set.
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Command Strip ────────────────────────────────────── */}
      {!metrics.error && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <AdminKpiCard
            label="Total Audits"
            value={metrics.total}
            tone="neutral"
            sublabel="Active"
          />
          <AdminKpiCard
            label="New Today"
            value={metrics.newToday}
            tone={metrics.newToday > 0 ? 'success' : 'neutral'}
            sublabel="Since midnight UTC"
          />
          <AdminKpiCard
            label="Pending Review"
            value={metrics.pending}
            tone={metrics.pending > 0 ? 'warning' : 'neutral'}
            sublabel="New + In Review"
          />
          <AdminKpiCard
            label="In Review"
            value={metrics.inReview}
            tone={metrics.inReview > 0 ? 'info' : 'neutral'}
            sublabel="Being reviewed"
          />
          <AdminKpiCard
            label="Converted"
            value={metrics.completed}
            tone={metrics.completed > 0 ? 'success' : 'neutral'}
            sublabel="Signed clients"
          />
          <AdminKpiCard
            label="High Priority"
            value={metrics.highPriority}
            tone={metrics.highPriority > 0 ? 'danger' : 'neutral'}
            sublabel={metrics.highPriority > 0 ? 'Act fast' : 'None flagged'}
          />
        </section>
      )}

      {/* ── Audit Table + Audit Review Focus ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Table (full width on mobile, 2/3 on desktop) */}
        <div className="lg:col-span-2">
          <AuditTableClient
            rows={table.rows}
            total={table.total}
            error={table.error}
          />
        </div>

        {/* Audit Review Focus panel */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <FileSearch size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Audit Review Focus</h2>
            </header>
            <div className="px-5 py-3.5 flex flex-col gap-3 text-[12.5px]">
              {!metrics.error && (
                <>
                  <FocusRow
                    label="Pending review"
                    value={metrics.pending}
                    note="New + In Review audits awaiting action"
                    tone={metrics.pending > 0 ? 'warning' : 'success'}
                  />
                  <FocusRow
                    label="High priority"
                    value={metrics.highPriority}
                    note="Urgent or high-priority leads"
                    tone={metrics.highPriority > 0 ? 'danger' : 'success'}
                  />
                  <FocusRow
                    label="Converted"
                    value={metrics.completed}
                    note="Leads converted to clients"
                    tone={metrics.completed > 0 ? 'success' : 'neutral'}
                  />
                </>
              )}
              <div className="border-t border-white/[0.06] pt-3 text-[12px] text-[#9a9a9d]">
                <p className="font-semibold text-white mb-1">Next steps</p>
                <ul className="flex flex-col gap-1.5 list-none">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                    <span>Mark new audits as In Review to track your progress</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                    <span>Convert qualified leads to start onboarding</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                    <span>Archive spam or unfit submissions to keep queue clean</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-5 text-[12.5px] text-[#9a9a9d]">
            <p className="font-semibold text-white mb-2 text-[13.5px]">Score legend</p>
            <div className="flex flex-col gap-1.5">
              <ScoreLegend color="#22d093" range="70–100" label="Strong fit — priority follow-up" />
              <ScoreLegend color="#ffae3c" range="40–69"  label="Potential — needs qualification" />
              <ScoreLegend color="#ff8a7a" range="0–39"   label="Low fit — review carefully" />
              <ScoreLegend color="#6a6a6e" range="—"      label="Score pending (AI not run)" />
            </div>
          </section>
        </aside>
      </div>

    </div>
  )
}

// ── Focus row ─────────────────────────────────────────────────────

function FocusRow({
  label, value, note, tone,
}: {
  label: string; value: number; note: string; tone: 'warning' | 'danger' | 'success' | 'neutral'
}) {
  const colors = { warning: '#ffae3c', danger: '#ff8a7a', success: '#22d093', neutral: '#6a6a6e' }
  const c = colors[tone]
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-white">{label}</span>
        <span className="text-[16px] font-bold tabular-nums" style={{ color: c }}>{value}</span>
      </div>
      <div className="text-[11px] text-[#6a6a6e] mt-0.5">{note}</div>
    </div>
  )
}

// ── Score legend ──────────────────────────────────────────────────

function ScoreLegend({ color, range, label }: { color: string; range: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="font-mono text-[11.5px] text-white w-12 shrink-0">{range}</span>
      <span className="text-[11.5px] text-[#9a9a9d]">{label}</span>
    </div>
  )
}
