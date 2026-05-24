import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_PIPELINE } from '@/lib/data/mock-team'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import LeadsTableClient from './LeadsTableClient'
import { ArrowLeft, TrendingUp } from 'lucide-react'

export const metadata = { title: 'Leads — Mission Control' }

export default async function AdminLeadsPage() {
  await requireAdmin({ path: '/admin/leads' })

  const total       = MOCK_PIPELINE.length
  const qualified   = MOCK_PIPELINE.filter((d) => d.stage === 'qualified' || d.stage === 'audit_sent' || d.stage === 'proposal').length
  const proposals   = MOCK_PIPELINE.filter((d) => d.stage === 'proposal').length
  const won         = MOCK_PIPELINE.filter((d) => d.stage === 'won').length
  const pipelineVal = MOCK_PIPELINE.filter((d) => d.stage !== 'lost').reduce((s, d) => s + d.value_usd, 0)
  const followUps   = MOCK_PIPELINE.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white">Leads Pipeline</h1>
          <span className="text-[9.5px] font-medium uppercase tracking-[0.08em]
                           px-2 py-0.5 rounded-full border border-white/[0.10] bg-white/[0.03] text-[#6a6a6e]">
            Pipeline
          </span>
        </div>
        <p className="text-[13px] text-[#9a9a9d]">
          Founder view of inbound and outbound lead opportunities across all stages.{' '}
          {/* TODO: wire to /admin/leads workspace when live CRM is connected */}
        </p>
      </header>

      {/* ── KPI Command Strip ────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard
          label="Total Leads"
          value={total}
          tone="neutral"
          sublabel="All stages"
        />
        <AdminKpiCard
          label="Qualified"
          value={qualified}
          tone="info"
          sublabel="Qualified → Proposal"
        />
        <AdminKpiCard
          label="Proposals Sent"
          value={proposals}
          tone="warning"
          sublabel="Awaiting decision"
        />
        <AdminKpiCard
          label="Won"
          value={won}
          tone="success"
          sublabel="Closed clients"
        />
        <AdminKpiCard
          label="Pipeline Value"
          value={`$${pipelineVal.toLocaleString()}`}
          tone="orange"
          sublabel="Excl. lost deals"
        />
        <AdminKpiCard
          label="Follow-Ups Due"
          value={followUps}
          tone={followUps > 0 ? 'warning' : 'neutral'}
          sublabel="Active leads"
        />
      </section>

      {/* ── Pipeline table + Sales Focus ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Table */}
        <div className="lg:col-span-2">
          <LeadsTableClient deals={MOCK_PIPELINE} />
        </div>

        {/* Sales Focus panel */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <TrendingUp size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Sales Focus</h2>
            </header>
            <div className="px-5 py-3.5 flex flex-col gap-3 text-[12.5px]">
              <PipelineFocusRow stage="Qualified"   count={qualified} value={MOCK_PIPELINE.filter((d) => d.stage === 'qualified').reduce((s, d) => s + d.value_usd, 0)}  color="#3b9eff" />
              <PipelineFocusRow stage="Audit Sent"  count={MOCK_PIPELINE.filter((d) => d.stage === 'audit_sent').length} value={MOCK_PIPELINE.filter((d) => d.stage === 'audit_sent').reduce((s, d) => s + d.value_usd, 0)} color="#ffae3c" />
              <PipelineFocusRow stage="Proposal"    count={proposals} value={MOCK_PIPELINE.filter((d) => d.stage === 'proposal').reduce((s, d) => s + d.value_usd, 0)}  color="#ff7a18" />
              <PipelineFocusRow stage="Won"         count={won}       value={MOCK_PIPELINE.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value_usd, 0)}       color="#22d093" />
              <div className="border-t border-white/[0.06] pt-2.5 flex items-center justify-between">
                <span className="text-[#9a9a9d]">Total pipeline value</span>
                <span className="text-[#ffae3c] font-semibold tabular-nums">${pipelineVal.toLocaleString()}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4">
            <p className="text-[13px] font-semibold text-white mb-2">Next best actions</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-[#9a9a9d]">
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Follow up on proposal-stage leads within 48 hours</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Move qualified audits to proposal stage</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span>
                <span>Check new audit submissions for hot leads</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

    </div>
  )
}

// ── Pipeline focus row ────────────────────────────────────────────

function PipelineFocusRow({
  stage, count, value, color,
}: {
  stage: string; count: number; value: number; color: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-[#9a9a9d] flex-1">{stage}</span>
      <span className="tabular-nums font-medium text-white">{count}</span>
      {value > 0 && (
        <span className="tabular-nums text-[11.5px] text-[#6a6a6e]">${value.toLocaleString()}</span>
      )}
    </div>
  )
}
