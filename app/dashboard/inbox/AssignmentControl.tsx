'use client'

import { useState, useTransition } from 'react'
import { assignConversation } from '@/lib/actions/inbox'

interface Props {
  sessionId:  string
  assignedTo: string | null
  onAssigned: () => void
}

export default function AssignmentControl({ sessionId, assignedTo, onAssigned }: Props) {
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
      onAssigned()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Assignment</p>
      {assignedTo ? (
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#3b9eff]/20 flex items-center justify-center text-[10px] text-[#3b9eff]">
            ✓
          </span>
          <span className="text-[12px] text-[#9a9a9d]">Assigned to you</span>
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
      {error   && <p className="text-[11px] text-[#ff8a7a]">{error}</p>}
      {success && <p className="text-[11px] text-[#22d093]">{success}</p>}
    </div>
  )
}
