import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_AGENT_RUNS } from '@/lib/data/mock-team'

const STATUS_TONE: Record<string, string> = {
  queued:   '#6a6a6e',
  running:  '#3b9eff',
  complete: '#22d093',
  failed:   '#ff8a7a',
}

export default async function TeamAgentRunsPage() {
  await requireTeam({ path: '/team/agent-runs' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Agent Runs</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          History of Relevance AI runs across business audits, QA, and outreach.
        </p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Agent</th>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Duration</th>
              <th className="text-left px-5 py-3">Triggered By</th>
              <th className="text-right px-5 py-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_AGENT_RUNS.map((r) => {
              const color = STATUS_TONE[r.status]
              return (
                <tr key={r.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3 text-white">{r.agent}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{r.business}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize"
                      style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[#9a9a9d]">
                    {r.duration_ms !== null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{r.triggered_by}</td>
                  <td className="px-5 py-3 text-right text-[12px] text-[#6a6a6e]">{new Date(r.started_at).toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
