'use client'

import { useState, useTransition } from 'react'
import { updateDeliveryTaskStatus } from '@/lib/actions/delivery'
import type { DeliveryTask } from '@/lib/actions/delivery'
import type { DeliveryTaskStatus } from '@/lib/validation/delivery'

interface Props {
  task:      DeliveryTask
  onUpdated: (id: string, status: DeliveryTaskStatus) => void
}

const STATUS_CONFIG: Record<DeliveryTaskStatus, { label: string; dot: string; bg: string; text: string }> = {
  pending:     { label: 'Pending',     dot: 'bg-[#6a6a6e]', bg: 'bg-white/[0.04]',       text: 'text-[#6a6a6e]' },
  in_progress: { label: 'In Progress', dot: 'bg-[#3b9eff]', bg: 'bg-[#3b9eff]/[0.08]',   text: 'text-[#3b9eff]' },
  blocked:     { label: 'Blocked',     dot: 'bg-[#ff8a7a]', bg: 'bg-[#ff8a7a]/[0.08]',   text: 'text-[#ff8a7a]' },
  completed:   { label: 'Completed',   dot: 'bg-[#22d093]', bg: 'bg-[#22d093]/[0.08]',   text: 'text-[#22d093]' },
  skipped:     { label: 'Skipped',     dot: 'bg-[#6a6a6e]', bg: 'bg-white/[0.04]',       text: 'text-[#6a6a6e]' },
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-[#ff8a7a]', high: 'text-[#ffae3c]', normal: 'text-[#9a9a9d]', low: 'text-[#6a6a6e]',
}

export default function DeliveryTaskCard({ task, onUpdated }: Props) {
  const cfg            = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending
  const [showBlock,    setShowBlock]  = useState(false)
  const [blockReason,  setBlockReason] = useState(task.blocked_reason ?? '')
  const [error,        setError]      = useState<string | null>(null)
  const [pending,      startTrans]    = useTransition()

  const act = (status: DeliveryTaskStatus, reason?: string) => {
    setError(null)
    if (status === 'blocked') { setShowBlock(true); return }
    startTrans(async () => {
      const result = await updateDeliveryTaskStatus(task.id, status, reason)
      if (result.error) { setError(result.error); return }
      onUpdated(task.id, status)
    })
  }

  const confirmBlock = () => {
    startTrans(async () => {
      const result = await updateDeliveryTaskStatus(task.id, 'blocked', blockReason)
      if (result.error) { setError(result.error); return }
      onUpdated(task.id, 'blocked')
      setShowBlock(false)
    })
  }

  const isDone = task.status === 'completed' || task.status === 'skipped'

  return (
    <div className={`border rounded-2xl p-4 transition-all ${
      isDone ? 'border-white/[0.05] bg-white/[0.01] opacity-70' :
      task.status === 'blocked' ? 'border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.03]' :
      task.status === 'in_progress' ? 'border-[#3b9eff]/20 bg-[#3b9eff]/[0.03]' :
      'border-white/[0.07] bg-[#0f1012]'
    }`}>
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${cfg.dot}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-[13px] font-medium ${isDone ? 'text-[#6a6a6e] line-through' : 'text-white'}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-semibold uppercase ${PRIORITY_COLOR[task.priority] ?? ''}`}>
                {task.priority}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
            </div>
          </div>

          {task.description && (
            <p className="text-[11.5px] text-[#6a6a6e] mt-1 leading-relaxed">{task.description}</p>
          )}

          {task.blocked_reason && task.status === 'blocked' && (
            <p className="text-[11px] text-[#ff8a7a] mt-1.5">Blocked: {task.blocked_reason}</p>
          )}

          {error && <p className="text-[11px] text-[#ff8a7a] mt-1">{error}</p>}

          {/* Block input */}
          {showBlock && (
            <div className="mt-2 flex flex-col gap-1.5">
              <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Reason for blocking (required)"
                maxLength={512}
                className="h-8 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12px] text-white placeholder-[#6a6a6e] outline-none" />
              <div className="flex gap-1.5">
                <button onClick={confirmBlock} disabled={!blockReason.trim() || pending}
                  className="h-7 px-3 rounded text-[11px] border border-[#ff8a7a]/30 text-[#ff8a7a] bg-[#ff8a7a]/[0.08] hover:bg-[#ff8a7a]/15 disabled:opacity-40">
                  {pending ? '…' : 'Confirm Block'}
                </button>
                <button onClick={() => setShowBlock(false)} className="h-7 px-2 rounded text-[11px] border border-white/[0.10] text-[#6a6a6e] hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isDone && !showBlock && (
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {task.status === 'pending' && (
                <button onClick={() => act('in_progress')} disabled={pending}
                  className="h-7 px-2.5 rounded-lg text-[11px] border border-[#3b9eff]/30 text-[#3b9eff] bg-[#3b9eff]/[0.06] hover:bg-[#3b9eff]/12 transition-all disabled:opacity-40">
                  Start
                </button>
              )}
              {['pending','in_progress'].includes(task.status) && (
                <>
                  <button onClick={() => act('completed')} disabled={pending}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-[#22d093]/30 text-[#22d093] bg-[#22d093]/[0.06] hover:bg-[#22d093]/12 transition-all disabled:opacity-40">
                    Complete
                  </button>
                  <button onClick={() => act('blocked')} disabled={pending}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-[#ff8a7a]/30 text-[#ff8a7a] bg-[#ff8a7a]/[0.06] hover:bg-[#ff8a7a]/12 transition-all disabled:opacity-40">
                    Block
                  </button>
                  <button onClick={() => act('skipped')} disabled={pending}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#6a6a6e] hover:bg-white/[0.04] hover:text-white transition-all disabled:opacity-40">
                    Skip
                  </button>
                </>
              )}
              {task.status === 'blocked' && (
                <button onClick={() => act('in_progress')} disabled={pending}
                  className="h-7 px-2.5 rounded-lg text-[11px] border border-[#3b9eff]/30 text-[#3b9eff] bg-[#3b9eff]/[0.06] hover:bg-[#3b9eff]/12 transition-all disabled:opacity-40">
                  Unblock
                </button>
              )}
            </div>
          )}
          {isDone && task.completed_at && (
            <p className="text-[10.5px] text-[#6a6a6e] mt-1.5">
              {task.status === 'completed' ? '✓ Completed' : '— Skipped'}{' '}
              {new Date(task.completed_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
