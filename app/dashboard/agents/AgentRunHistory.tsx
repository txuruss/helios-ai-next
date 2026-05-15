'use client'

import type { AgentRun } from '@/types'

const STATUS_PILL: Record<string, string> = {
  pending:   'pill pill-amber',
  running:   'pill pill-cyan',
  completed: 'pill pill-green',
  failed:    'pill pill-red',
  cancelled: 'pill pill-mute',
}

interface Props {
  runs:          AgentRun[]
  onSelectRun?:  (run: AgentRun) => void
}

export default function AgentRunHistory({ runs, onSelectRun }: Props) {
  if (runs.length === 0) {
    return (
      <div className="border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">◎</div>
        <p className="text-[14px] text-[#6a6a6e]">No agent runs yet. Click Run on any agent to start.</p>
      </div>
    )
  }

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <table className="helios-table">
        <thead>
          <tr>
            <th>Agent / Workforce</th>
            <th>Type</th>
            <th>Status</th>
            <th>Input</th>
            <th>Started</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="font-medium text-white max-w-[180px] truncate">
                {run.input_summary ?? '—'}
              </td>
              <td>
                <span className="text-[11px] px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.06] text-[#9a9a9d] capitalize">
                  {run.run_type}
                </span>
              </td>
              <td>
                <span className={STATUS_PILL[run.status] ?? 'pill pill-mute'}>{run.status}</span>
              </td>
              <td className="text-[12.5px] text-[#9a9a9d] max-w-[200px] truncate">
                {run.output_summary ?? '—'}
              </td>
              <td className="font-mono text-[11.5px] text-[#6a6a6e] whitespace-nowrap">
                {new Date(run.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td>
                {onSelectRun && (
                  <button
                    onClick={() => onSelectRun(run)}
                    className="h-7 px-3 rounded-lg text-[12px] border border-white/10 bg-white/[0.02]
                               text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">
                    View
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
