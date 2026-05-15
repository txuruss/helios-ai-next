'use client'

import { useState, useTransition } from 'react'
import { addInternalNote } from '@/lib/actions/inbox'

interface Props {
  sessionId:  string
  onNoteAdded: () => void
}

export default function InternalNotes({ sessionId, onNoteAdded }: Props) {
  const [note,    setNote]    = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (!note.trim()) return
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await addInternalNote(sessionId, note.trim())
      if (result.error) { setError(result.error); return }
      setSuccess('Note saved.')
      setNote('')
      onNoteAdded()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Internal Note</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a private note visible only to your team…"
        rows={3}
        maxLength={4000}
        className="w-full rounded-xl bg-[#ffae3c]/[0.04] border border-[#ffae3c]/20 px-3 py-2.5
                   text-[12.5px] text-white placeholder-[#6a6a6e] resize-none outline-none
                   focus:border-[#ffae3c]/40 transition-colors"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          {error   && <p className="text-[11px] text-[#ff8a7a]">{error}</p>}
          {success && <p className="text-[11px] text-[#22d093]">{success}</p>}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !note.trim()}
          className="h-8 px-3 rounded-lg border border-[#ffae3c]/30 bg-[#ffae3c]/[0.08]
                     text-[11.5px] font-medium text-[#ffae3c] hover:bg-[#ffae3c]/15 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}
