'use client'

import { useState, useTransition } from 'react'
import { assignConversation, unassignConversation } from '@/lib/actions/inbox'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  sessionId:  string
  assignedTo: string | null
  onUpdated:  () => void
}

export default function AssignmentControl({ sessionId, assignedTo, onUpdated }: Props) {
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleAssign = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await assignConversation(sessionId)
      if (result.error) { setError(result.error); return }
      setSuccess(result.success ?? 'Assigned.')
      capture('conversation_assigned', { session_id: sessionId.slice(0, 8) })
      onUpdated()
    })
  }

  const handleUnassign = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await unassignConversation(sessionId)
      if (result.error) { setError(result.error); return }
      setSuccess(result.success ?? 'Unassigned.')
      capture('conversation_unassigned', { session_id: sessionId.slice(0, 8) })
      onUpdated()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Assignment</p>

      {assignedTo ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#3b9eff]/20 flex items-center justify-center text-[10px] text-[#3b9eff] shrink-0">
              ✓
            </span>
            <span className="text-[12px] text-[#9a9a9d]">Assigned to you</span>
          </div>
          <button
            type="button"
            onClick={handleUnassign}
            disabled={pending}
            className="self-start h-7 px-3 rounded-lg border border-white/[0.08] bg-transparent
                       text-[11px] font-medium text-[#6a6a6e] hover:text-[#ff8a7a] hover:border-[#ff8a7a]/30
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Removing…' : 'Unassign'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAssign}
          disabled={pending}
          className="self-start h-8 px-3 rounded-lg border border-white/[0.12] bg-white/[0.04]
                     text-[11.5px] font-medium text-[#9a9a9d] hover:bg-white/[0.08] transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Assigning…' : 'Assign to me'}
        </button>
      )}

      <p className="text-[10.5px] text-[#4a4a4e]">
        Multi-agent assignment available in Phase 12.
      </p>

      {error   && <p className="text-[11px] text-[#ff8a7a]">{error}</p>}
      {success && <p className="text-[11px] text-[#22d093]">{success}</p>}
    </div>
  )
}
