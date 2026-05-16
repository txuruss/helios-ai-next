'use client'

import { useState, useTransition } from 'react'
import { updateOpsTaskStatus } from '@/lib/actions/ops'
import type { OpsTask } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props { tasks: OpsTask[]; onRefresh: () => void }

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-[#ff8a7a]',
  high:   'text-[#ffae3c]',
  normal: 'text-[#9a9a9d]',
  low:    'text-[#6a6a6e]',
}

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  pending:     { label: 'Pending',     bg: 'bg-[#ffae3c]/10 text-[#ffae3c]' },
  in_progress: { label: 'In Progress', bg: 'bg-[#3b9eff]/10 text-[#3b9eff]' },
  completed:   { label: 'Completed',   bg: 'bg-[#22d093]/10 text-[#22d093]' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-white/[0.06] text-[#6a6a6e]' },
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function OpsTaskBoard({ tasks, onRefresh }: Props) {
  const [filter, setFilter]  = useState('pending')
  const [pending, startTransition] = useTransition()

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)

  const setStatus = (id: string, status: string) => {
    startTransition(async () => {
      await updateOpsTaskStatus(id, status)
      if (status === 'completed') capture('ops_task_completed', {})
      onRefresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 flex-wrap">
        {['pending', 'in_progress', 'completed', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize
                        ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">📋</span>
          <p className="text-[13px] font-medium text-white">No tasks</p>
          <p className="text-[12px] text-[#6a6a6e]">No {filter !== 'all' ? filter.replace('_', ' ') : ''} tasks right now.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04] rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          {filtered.map((task) => {
            const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending
            return (
              <div key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className={`mt-0.5 shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${PRIORITY_COLOR[task.priority]}`}>
                  {task.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white">{task.title}</p>
                  {task.description && <p className="text-[11.5px] text-[#9a9a9d] mt-0.5 truncate">{task.description}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e] mt-0.5 capitalize">{task.task_type} · {relTime(task.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${sCfg.bg}`}>
                    {sCfg.label}
                  </span>
                  {task.status === 'pending' && (
                    <button onClick={() => setStatus(task.id, 'in_progress')} disabled={pending}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">
                      Start
                    </button>
                  )}
                  {(task.status === 'pending' || task.status === 'in_progress') && (
                    <button onClick={() => setStatus(task.id, 'completed')} disabled={pending}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
                      Done
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
