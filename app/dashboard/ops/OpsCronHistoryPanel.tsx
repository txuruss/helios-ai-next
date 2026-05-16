'use client'

import { useState, useTransition, useEffect } from 'react'
import { getOpsCronRuns } from '@/lib/actions/ops'
import type { OpsCronRun } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

const STATUS_CONFIG: Record<string, { text: string; bg: string }> = {
  completed: { text: 'text-[#22d093]', bg: 'bg-[#22d093]/10' },
  failed:    { text: 'text-[#ff8a7a]', bg: 'bg-[#ff8a7a]/10' },
  started:   { text: 'text-[#3b9eff]', bg: 'bg-[#3b9eff]/10' },
  skipped:   { text: 'text-[#6a6a6e]', bg: 'bg-white/[0.06]' },
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function OpsCronHistoryPanel() {
  const [runs,    setRuns]    = useState<OpsCronRun[]>([])
  const [total,   setTotal]   = useState(0)
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startLoad]  = useTransition()

  useEffect(() => {
    capture('ops_cron_history_viewed', {})
    load()
  }, [])

  const load = () => {
    startLoad(async () => {
      const result = await getOpsCronRuns({ pageSize: 15 })
      if (result.error) { setError(result.error); return }
      setRuns(result.rows); setTotal(result.total_count)
    })
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">SLA Cron History</p>
        <div className="flex items-center gap-2">
          {total > 0 && <span className="text-[11px] text-[#6a6a6e]">{total} runs</span>}
          <button onClick={load} disabled={pending}
            className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
            {pending ? '…' : '↻'}
          </button>
        </div>
      </div>

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {runs.length === 0 && !pending ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[20px]">⏱</span>
          <p className="text-[12.5px] text-white font-medium">No cron runs yet</p>
          <p className="text-[11.5px] text-[#6a6a6e]">Runs appear after the cron endpoint is triggered.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {runs.map((run) => {
              const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.started
              return (
                <div key={run.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.bg} ${cfg.text}`}>
                    {run.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12px] text-white">{run.job_name}</p>
                      {run.trigger_source && (
                        <span className="text-[10px] text-[#6a6a6e] capitalize">{run.trigger_source.replace(/_/g,' ')}</span>
                      )}
                      {run.cron_secret_type && (
                        <span className="text-[10px] text-[#6a6a6e]">{run.cron_secret_type}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10.5px] text-[#6a6a6e]">
                      <span>✓ {run.checked_count}</span>
                      {run.breached_count > 0 && <span className="text-[#ff8a7a]">↑ {run.breached_count} breached</span>}
                      {run.escalated_count > 0 && <span className="text-[#c084fc]">⬆ {run.escalated_count} escalated</span>}
                      {(run.failed_count ?? 0) > 0 && <span className="text-[#ff8a7a]">✗ {run.failed_count} failed</span>}
                      <span>{fmtDuration(run.duration_ms)}</span>
                    </div>
                  </div>
                  <span className="text-[10.5px] text-[#6a6a6e] font-mono shrink-0">{relTime(run.started_at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
