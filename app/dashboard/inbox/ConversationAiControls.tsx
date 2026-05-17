'use client'

import { useState, useTransition } from 'react'
import { pauseConversationAi, resumeConversationAi } from '@/lib/actions/inbox'

interface Props {
  sessionId:  string
  aiPaused:   boolean
  onUpdated?: () => void
}

export default function ConversationAiControls({ sessionId, aiPaused, onUpdated }: Props) {
  const [paused,  setPaused]  = useState(aiPaused)
  const [reason,  setReason]  = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startTrans] = useTransition()

  const handlePause = () => {
    setError(null)
    startTrans(async () => {
      const result = await pauseConversationAi(sessionId, reason || undefined)
      if (result.error) { setError(result.error); return }
      setPaused(true); setReason('')
      onUpdated?.()
    })
  }

  const handleResume = () => {
    setError(null)
    startTrans(async () => {
      const result = await resumeConversationAi(sessionId)
      if (result.error) { setError(result.error); return }
      setPaused(false)
      onUpdated?.()
    })
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-t border-white/[0.06]">
      <div className="flex items-center gap-2 flex-wrap">
        {paused ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-[#ffae3c]/30 bg-[#ffae3c]/[0.08] text-[#ffae3c]">
              ⏸ AI paused for this conversation
            </span>
            <button onClick={handleResume} disabled={pending}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-[#22d093]/30 text-[#22d093] bg-[#22d093]/[0.06]
                         hover:bg-[#22d093]/15 transition-all disabled:opacity-40">
              {pending ? '…' : '▶ Resume AI'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for pausing AI (optional)"
              maxLength={256}
              className="h-8 flex-1 min-w-[160px] rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[12px]
                         text-white placeholder-[#6a6a6e] outline-none focus:border-[#ffae3c]/40"
            />
            <button onClick={handlePause} disabled={pending}
              className="h-8 px-3 rounded-lg text-[11.5px] border border-[#ffae3c]/30 text-[#ffae3c] bg-[#ffae3c]/[0.06]
                         hover:bg-[#ffae3c]/15 transition-all disabled:opacity-40 whitespace-nowrap">
              {pending ? '…' : '⏸ Pause AI'}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-[11px] text-[#ff8a7a]">{error}</p>}
    </div>
  )
}
