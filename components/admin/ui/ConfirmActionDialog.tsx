'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  open:         boolean
  title:        string
  body:         string
  confirmLabel: string
  loading?:     boolean
  onConfirm:    () => void
  onCancel:     () => void
}

export default function ConfirmActionDialog({
  open, title, body, confirmLabel, loading = false, onConfirm, onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-[400px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <h2 id="confirm-dialog-title" className="text-[15px] font-semibold text-white leading-snug">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="text-[#6a6a6e] hover:text-white transition-colors shrink-0 mt-0.5"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <p className="px-5 pb-5 text-[13px] text-[#9a9a9d] leading-relaxed">{body}</p>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 px-5 pb-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#9a9a9d]
                       border border-white/[0.08] bg-white/[0.03]
                       hover:bg-white/[0.06] hover:text-white transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-medium
                       bg-[#ff4d3a]/[0.12] border border-[#ff4d3a]/30 text-[#ff8a7a]
                       hover:bg-[#ff4d3a]/20 hover:text-white transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-[#ff4d3a]/40"
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>

      </div>
    </div>
  )
}
