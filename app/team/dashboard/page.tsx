import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_PIPELINE, MOCK_DELIVERY, MOCK_AGENT_RUNS } from '@/lib/data/mock-team'

export default async function TeamDashboardPage() {
  const session = await requireTeam({ path: '/team/dashboard' })

  const totals = {
    activePipeline: MOCK_PIPELINE.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length,
    activeProjects: MOCK_DELIVERY.length,
    agentsRunning:  MOCK_AGENT_RUNS.filter((r) => r.status === 'running').length,
    revenuePipe:    MOCK_PIPELINE.reduce((s, d) => s + d.value_usd, 0),
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Welcome back, {(session.fullName ?? 'Team').split(' ')[0]}.</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Internal team operations dashboard.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Pipeline" value={String(totals.activePipeline)} hint="deals" />
        <StatCard label="Active Projects" value={String(totals.activeProjects)} hint="in delivery" />
        <StatCard label="Agents Running"  value={String(totals.agentsRunning)} hint="now" tone="info" />
        <StatCard label="Pipeline Value"  value={`$${(totals.revenuePipe / 1000).toFixed(1)}k`} hint="USD" tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top deals">
          {MOCK_PIPELINE.slice(0, 4).map((d) => (
            <RowItem key={d.id} title={d.business} subtitle={`${d.stage} · $${d.value_usd}`} right={d.next_action} />
          ))}
        </Panel>
        <Panel title="Active projects">
          {MOCK_DELIVERY.map((p) => (
            <RowItem key={p.id} title={p.business} subtitle={`${p.stage} · ${p.progress}%`} right={`Due ${p.due_date}`} />
          ))}
        </Panel>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'success' | 'info' }) {
  const border = tone === 'success' ? 'border-[#22d093]/25 bg-[#22d093]/[0.05]'
                : tone === 'info'   ? 'border-[#3b9eff]/25 bg-[#3b9eff]/[0.05]'
                : 'border-white/[0.08] bg-[#0f1012]/60'
  return (
    <div className={`rounded-2xl border p-4 ${border}`}>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</div>
      <div className="text-[26px] font-semibold mt-1 text-white">{value}</div>
      {hint && <div className="text-[11px] text-[#6a6a6e] mt-0.5">{hint}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <h3 className="text-[14px] font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  )
}

function RowItem({ title, subtitle, right }: { title: string; subtitle: string; right: string }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-white truncate">{title}</div>
        <div className="text-[12px] text-[#6a6a6e]">{subtitle}</div>
      </div>
      <div className="text-[12px] text-[#9a9a9d] text-right shrink-0">{right}</div>
    </div>
  )
}
