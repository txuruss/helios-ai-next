'use client'

import { useTransition } from 'react'
import { updateRecommendationStatus } from '@/lib/actions/relevance'
import type { AgentRecommendation } from '@/types'

const PRIORITY_COLOR: Record<string, string> = {
  low:      'text-[#6a6a6e] border-white/10',
  medium:   'text-[#ffae3c] border-[#ffae3c]/30',
  high:     'text-[#ff8a7a] border-[#ff6a5a]/30',
  critical: 'text-white border-[#ff6a5a]/50 bg-[#ff6a5a]/[0.06]',
}

const STATUS_PILL: Record<string, string> = {
  pending:   'pill pill-amber',
  approved:  'pill pill-green',
  rejected:  'pill pill-red',
  completed: 'pill pill-cyan',
}

interface Props {
  rec: AgentRecommendation
}

export default function AgentRecommendationCard({ rec }: Props) {
  const [pending, startTransition] = useTransition()

  const update = (status: AgentRecommendation['status']) => {
    startTransition(async () => { await updateRecommendationStatus(rec.id, status) })
  }

  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-3 transition-all ${PRIORITY_COLOR[rec.priority]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`pill text-[10px] border ${PRIORITY_COLOR[rec.priority]}`}>
              {rec.priority.toUpperCase()}
            </span>
            <span className={STATUS_PILL[rec.status] ?? 'pill pill-mute'}>{rec.status}</span>
          </div>
          <h4 className="text-[14px] font-semibold text-white">{rec.title}</h4>
        </div>
      </div>

      {rec.description && (
        <p className="text-[13px] text-[#9a9a9d] leading-relaxed">{rec.description}</p>
      )}

      {rec.status === 'pending' && (
        <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
          <button
            disabled={pending}
            onClick={() => update('approved')}
            className="h-8 px-3 rounded-lg text-[12px] bg-[#22d093]/12 border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/20 transition-all disabled:opacity-40">
            Approve
          </button>
          <button
            disabled={pending}
            onClick={() => update('rejected')}
            className="h-8 px-3 rounded-lg text-[12px] border border-[#ff6a5a]/20 text-[#ff8a7a] hover:bg-[#ff6a5a]/10 transition-all disabled:opacity-40">
            Reject
          </button>
        </div>
      )}
      {rec.status === 'approved' && (
        <div className="pt-1 border-t border-white/[0.06]">
          <button
            disabled={pending}
            onClick={() => update('completed')}
            className="h-8 px-3 rounded-lg text-[12px] border border-[#22d093]/20 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
            Mark Completed
          </button>
        </div>
      )}
    </div>
  )
}
