'use client'

import { useState, useTransition } from 'react'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  token:     string
  bookingId: string
}

export default function BookingPortalClient({ token, bookingId }: Props) {
  const [done,     setDone]     = useState(false)
  const [action,   setAction]   = useState<'confirmed' | 'rejected' | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [reason,   setReason]   = useState('')
  const [showRej,  setShowRej]  = useState(false)
  const [pending,  startAction] = useTransition()

  const handleConfirm = () => {
    startAction(async () => {
      try {
        const res = await fetch(`/api/booking/${token}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) { setError(data.error ?? 'Could not confirm.'); return }
        setAction('confirmed'); setDone(true)
        capture('booking_customer_confirmed', { status: 'confirmed' })
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  const handleReject = () => {
    startAction(async () => {
      try {
        const res = await fetch(`/api/booking/${token}/reject`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ reason: reason.trim() || undefined }),
        })
        const data = await res.json() as { ok?: boolean; error?: string }
        if (!res.ok) { setError(data.error ?? 'Could not cancel.'); return }
        setAction('rejected'); setDone(true)
        capture('booking_rejected', { actor: 'customer' })
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  if (done) {
    return (
      <div className={`px-4 py-4 rounded-xl border ${
        action === 'confirmed'
          ? 'border-[#22d093]/20 bg-[#22d093]/[0.05] text-[#22d093]'
          : 'border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.05] text-[#ff8a7a]'
      } text-[13.5px] font-medium text-center`}>
        {action === 'confirmed'
          ? '✅ Booking confirmed! The business will be notified.'
          : '✗ Booking request cancelled.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 mb-5">
      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={pending}
        className="h-11 rounded-xl font-semibold text-[14px]
                   bg-gradient-to-b from-[#22d093] to-[#19a572] text-[#001a0f]
                   hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {pending ? 'Processing…' : '✓ Confirm Booking'}
      </button>

      {!showRej ? (
        <button
          onClick={() => setShowRej(true)}
          className="h-9 rounded-xl text-[13px] text-[#9a9a9d] border border-white/[0.10]
                     hover:bg-white/[0.04] hover:text-white transition-all"
        >
          ✗ Cancel Request
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancelling (optional)"
            maxLength={256}
            rows={2}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2
                       text-[12.5px] text-white placeholder-[#6a6a6e] outline-none
                       focus:border-[#ff8a7a]/40 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={pending}
              className="flex-1 h-9 rounded-lg text-[13px] border border-[#ff8a7a]/30 text-[#ff8a7a]
                         bg-[#ff8a7a]/[0.08] hover:bg-[#ff8a7a]/15 transition-all disabled:opacity-40"
            >
              Confirm Cancel
            </button>
            <button
              onClick={() => setShowRej(false)}
              className="h-9 px-4 rounded-lg text-[13px] border border-white/[0.10] text-[#9a9a9d]
                         hover:bg-white/[0.04] transition-all"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
