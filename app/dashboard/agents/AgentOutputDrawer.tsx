'use client'

import { useTransition } from 'react'
import { updateOutputStatus } from '@/lib/actions/relevance'
import type { AgentOutput, AgentRun } from '@/types'

interface Props {
  run:      AgentRun
  outputs:  AgentOutput[]
  onClose:  () => void
}

const STATUS_PILL: Record<string, string> = {
  pending_review: 'pill pill-amber',
  approved:       'pill pill-green',
  rejected:       'pill pill-red',
  archived:       'pill pill-mute',
}

function OutputCard({ output, onUpdate }: { output: AgentOutput; onUpdate: (id: string, status: AgentOutput['status']) => void }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13.5px] font-medium text-white">{output.title ?? 'Output'}</div>
        <span className={STATUS_PILL[output.status] ?? 'pill pill-mute'}>{output.status.replace('_', ' ')}</span>
      </div>

      {output.content && (
        <pre className="font-mono text-[11.5px] text-[#9a9a9d] bg-[#070708] border border-white/[0.06] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
          {output.content.slice(0, 2000)}{output.content.length > 2000 ? '\n…(truncated)' : ''}
        </pre>
      )}

      {output.status === 'pending_review' && (
        <div className="flex gap-2">
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await updateOutputStatus(output.id, 'approved') ; onUpdate(output.id, 'approved') })}
            className="h-8 px-3 rounded-lg text-[12px] bg-[#22d093]/12 border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/20 transition-all disabled:opacity-40">
            Approve
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await updateOutputStatus(output.id, 'rejected') ; onUpdate(output.id, 'rejected') })}
            className="h-8 px-3 rounded-lg text-[12px] border border-[#ff6a5a]/20 text-[#ff8a7a] hover:bg-[#ff6a5a]/10 transition-all disabled:opacity-40">
            Reject
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await updateOutputStatus(output.id, 'archived') ; onUpdate(output.id, 'archived') })}
            className="h-8 px-3 rounded-lg text-[12px] border border-white/10 text-[#9a9a9d] hover:text-white transition-all disabled:opacity-40">
            Archive
          </button>
        </div>
      )}
    </div>
  )
}

export default function AgentOutputDrawer({ run, outputs: initialOutputs, onClose }: Props) {
  const STATUS_PILL_RUN: Record<string, string> = { completed: 'pill-green', failed: 'pill-red', running: 'pill-cyan', pending: 'pill-amber' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0f1012] border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-[17px] font-semibold">Run Output</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`pill text-[10.5px] ${STATUS_PILL_RUN[run.status] ?? 'pill-mute'}`}>{run.status}</span>
              <span className="text-[12px] text-[#6a6a6e] font-mono">{run.id.slice(0, 8)}</span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#6a6a6e] hover:text-white transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          {run.output_summary && (
            <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[13px] text-[#9a9a9d]">
              {run.output_summary}
            </div>
          )}

          {initialOutputs.length === 0 ? (
            <p className="text-[13.5px] text-[#6a6a6e] text-center py-8">
              {run.status === 'running' ? 'Agent is still running…' : 'No outputs yet.'}
            </p>
          ) : (
            initialOutputs.map((output) => (
              <OutputCard
                key={output.id}
                output={output}
                onUpdate={() => { /* optimistic only */ }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
