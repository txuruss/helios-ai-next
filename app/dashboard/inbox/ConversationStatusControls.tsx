'use client'

import { useState, useTransition } from 'react'
import { updateConversationStatus } from '@/lib/actions/inbox'
import type { HandoffStatus } from '@/types'

interface Props {
  sessionId:     string
  currentStatus: HandoffStatus
  onUpdated:     () => void
}

const ACTIONS: Array<{
  targetStatus: HandoffStatus
  label:        string
  color:        string
  fromStatuses: HandoffStatus[]
}> = [
  {
    targetStatus: 'human',
    label:        'Mark Human',
    color:        'text-[#3b9eff] border-[#3b9eff]/30 bg-[#3b9eff]/[0.08] hover:bg-[#3b9eff]/15',
    fromStatuses: ['ai', 'human_requested'],
  },
  {
    targetStatus: 'ai',
    label:        'Return to AI',
    color:        'text-[#22d093] border-[#22d093]/30 bg-[#22d093]/[0.08] hover:bg-[#22d093]/15',
    fromStatuses: ['human_requested', 'human'],
  },
  {
    targetStatus: 'resolved',
    label:        'Resolve',
    color:        'text-[#9a9a9d] border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]',
    fromStatuses: ['ai', 'human_requested', 'human'],
  },
  {
    targetStatus: 'archived',
    label:        'Archive',
    color:        'text-[#6a6a6e] border-white/[0.08] bg-transparent hover:bg-white/[0.04]',
    fromStatuses: ['resolved', 'ai', 'human', 'human_requested'],
  },
]

export default function ConversationStatusControls({ sessionId, currentStatus, onUpdated }: Props) {
  const [error, setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const available = ACTIONS.filter((a) => a.fromStatuses.includes(currentStatus))

  const handleUpdate = (status: HandoffStatus) => {
    setError(null)
    startTransition(async () => {
      const result = await updateConversationStatus(sessionId, status)
      if (result.error) { setError(result.error); return }
      onUpdated()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Status</p>
      <div className="flex flex-wrap gap-2">
        {available.map((a) => (
          <button
            key={a.targetStatus}
            onClick={() => handleUpdate(a.targetStatus)}
            disabled={pending}
            className={`h-8 px-3 rounded-lg border text-[11.5px] font-medium transition-all
                        disabled:opacity-40 disabled:cursor-not-allowed ${a.color}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-[11px] text-[#ff8a7a]">{error}</p>}
    </div>
  )
}
