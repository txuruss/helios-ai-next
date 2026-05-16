'use client'

import { useState, useTransition } from 'react'
import { runProductionLaunchChecks, getProductionLaunchChecks } from '@/lib/actions/ops'
import type { LaunchCheck } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  initialChecks: LaunchCheck[]
}

const STATUS_CONFIG: Record<string, { icon: string; text: string; bg: string }> = {
  passed:  { icon: '✓', text: 'text-[#22d093]', bg: 'bg-[#22d093]/10' },
  warning: { icon: '⚠', text: 'text-[#ffae3c]', bg: 'bg-[#ffae3c]/10' },
  failed:  { icon: '✗', text: 'text-[#ff8a7a]', bg: 'bg-[#ff8a7a]/10' },
  pending: { icon: '○', text: 'text-[#6a6a6e]', bg: 'bg-white/[0.04]' },
  skipped: { icon: '—', text: 'text-[#6a6a6e]', bg: 'bg-white/[0.04]' },
}

const SEV_COLOR: Record<string, string> = {
  critical: 'text-[#ff8a7a]', high: 'text-[#ffae3c]', normal: 'text-[#9a9a9d]', low: 'text-[#6a6a6e]',
}

function groupByCategory(checks: LaunchCheck[]): Record<string, LaunchCheck[]> {
  return checks.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {} as Record<string, LaunchCheck[]>)
}

export default function ProductionLaunchChecklist({ initialChecks }: Props) {
  const [checks,        setChecks]        = useState(initialChecks)
  const [createTasks,   setCreateTasks]   = useState(false)
  const [msg,           setMsg]           = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [runPending,    startRun]         = useTransition()
  const [refreshPending, startRefresh]    = useTransition()

  const passed   = checks.filter((c) => c.status === 'passed').length
  const failed   = checks.filter((c) => c.status === 'failed').length
  const warnings = checks.filter((c) => c.status === 'warning').length
  const total    = checks.length

  const handleRun = () => {
    setMsg(null); setError(null)
    startRun(async () => {
      const result = await runProductionLaunchChecks(createTasks)
      if (result.error) { setError(result.error); return }
      setChecks(result.checks)
      const f = result.checks.filter((c) => c.status === 'failed').length
      setMsg(`Ran ${result.checks.length} checks — ${f} failed.`)
      capture('ops_launch_check_run', { count: result.checks.length, failed: f })
      if (createTasks && f > 0) capture('ops_launch_check_failed_task_created', { count: f })
    })
  }

  const handleRefresh = () => {
    startRefresh(async () => {
      const result = await getProductionLaunchChecks()
      if (!result.error) setChecks(result.checks)
    })
  }

  const grouped = groupByCategory(checks)

  return (
    <div className="flex flex-col gap-4 mt-4 border-t border-white/[0.06] pt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[12px] font-semibold text-white">Production Launch Checklist</p>
          {total > 0 && (
            <p className="text-[11px] text-[#6a6a6e] mt-0.5">
              {passed}/{total} passed · {failed} failed · {warnings} warnings
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-[11.5px] text-[#9a9a9d] cursor-pointer">
            <input type="checkbox" checked={createTasks} onChange={(e) => setCreateTasks(e.target.checked)}
              className="accent-[#ff7a18]" />
            Create tasks for failures
          </label>
          <button onClick={handleRun} disabled={runPending}
            className="h-8 px-4 rounded-[10px] text-[12.5px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
            {runPending ? 'Running…' : '▶ Run Checks'}
          </button>
          <button onClick={handleRefresh} disabled={refreshPending}
            className="h-8 px-3 rounded-[10px] text-[12.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] transition-all disabled:opacity-40">
            ↻
          </button>
        </div>
      </div>

      {msg   && <p className="text-[12px] text-[#22d093]">{msg}</p>}
      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {checks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[22px]">🚀</span>
          <p className="text-[13px] font-medium text-white">No checks run yet</p>
          <p className="text-[12px] text-[#6a6a6e]">Click "Run Checks" to audit your production configuration.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.04]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]">{category}</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {items.map((check) => {
                  const cfg = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.pending
                  return (
                    <div key={check.check_key} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${cfg.bg} ${cfg.text}`}>
                        {cfg.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-white">{check.title}</p>
                        {check.description && <p className="text-[11px] text-[#6a6a6e] mt-0.5">{check.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold uppercase ${SEV_COLOR[check.severity]}`}>{check.severity}</span>
                        <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full capitalize ${cfg.bg} ${cfg.text}`}>
                          {check.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
