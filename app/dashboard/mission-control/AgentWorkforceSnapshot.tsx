import Link from 'next/link'

interface AgentRun {
  id:           string
  run_type:     string
  status:       string
  input_summary: string | null
  created_at:   string
}

interface Props {
  recentRuns: AgentRun[]
  totalRuns:  number
}

const STATUS_COLOR: Record<string, string> = {
  completed:  'text-[#22d093] bg-[#22d093]/10',
  running:    'text-[#3b9eff] bg-[#3b9eff]/10',
  failed:     'text-[#ff8a7a] bg-[#ff8a7a]/10',
  pending:    'text-[#ffae3c] bg-[#ffae3c]/10',
  cancelled:  'text-[#6a6a6e] bg-white/[0.04]',
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AgentWorkforceSnapshot({ recentRuns, totalRuns }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">
            Agent Runs
          </div>
          {totalRuns > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[#9a9a9d]">
              {totalRuns} total
            </span>
          )}
        </div>
        <Link href="/dashboard/agents" className="text-[11.5px] text-[#ff7a18] hover:text-[#ffae3c] transition-colors">
          View agents →
        </Link>
      </div>

      {recentRuns.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="text-[20px]">🤖</span>
          <p className="text-[12.5px] text-white font-medium">No agent runs yet</p>
          <p className="text-[11.5px] text-[#6a6a6e]">Run your first agent from the AI Agents page.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recentRuns.slice(0, 5).map((run) => (
            <div key={run.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02]">
              <span className="text-[14px]">{run.run_type === 'workforce' ? '⚡' : '🤖'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-white truncate">
                  {run.input_summary ?? (run.run_type === 'workforce' ? 'Workforce run' : 'Agent run')}
                </p>
                <p className="text-[11px] text-[#6a6a6e] capitalize">{run.run_type} · {relTime(run.created_at)}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[run.status] ?? STATUS_COLOR.pending}`}>
                {run.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
