'use client'

import { useState, useTransition } from 'react'
import { ownerConfirmBooking, ownerRejectBooking, resendBookingConfirmationEmail } from '@/lib/actions/bookings'

interface Props {
  bookingId:          string
  confirmationStatus: string
  portalToken?:       string | null
  portalUrl?:         string | null
  hasCustomerEmail?:  boolean
  resendCount?:       number
  onUpdated?:         () => void
}

export default function BookingActionsClient({
  bookingId,
  confirmationStatus,
  portalToken,
  portalUrl,
  hasCustomerEmail,
  resendCount,
  onUpdated,
}: Props) {
  const [msg,        setMsg]        = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [reason,     setReason]     = useState('')
  const [confirming, startConfirm]  = useTransition()
  const [rejecting,  startReject]   = useTransition()
  const [resending,  startResend]   = useTransition()
  const [copied,     setCopied]     = useState(false)

  const canAct = ['pending', 'customer_confirmed'].includes(confirmationStatus)

  const handleConfirm = () => {
    setError(null); setMsg(null)
    startConfirm(async () => {
      const result = await ownerConfirmBooking(bookingId)
      if (result.error) { setError(result.error); return }
      setMsg(result.success ?? 'Confirmed.')
      onUpdated?.()
    })
  }

  const handleReject = () => {
    setError(null); setMsg(null)
    startReject(async () => {
      const result = await ownerRejectBooking(bookingId, reason || undefined)
      if (result.error) { setError(result.error); return }
      setMsg(result.success ?? 'Rejected.')
      setShowReject(false)
      onUpdated?.()
    })
  }

  const handleResend = () => {
    setError(null)
    startResend(async () => {
      const result = await resendBookingConfirmationEmail(bookingId)
      if (result.error) { setError(result.error); return }
      if (result.skipped) { setMsg('Email skipped — Resend not configured.'); return }
      setMsg('✓ Confirmation email resent.')
      onUpdated?.()
    })
  }

  const handleCopyPortal = () => {
    if (!portalUrl) return
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (msg) {
    return <span className="text-[11px] text-[#22d093]">{msg}</span>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {error && <p className="text-[10px] text-[#ff8a7a]">{error}</p>}

      {canAct && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={handleConfirm} disabled={confirming}
            className="h-7 px-2.5 rounded-lg text-[11px] border border-[#22d093]/30 text-[#22d093] bg-[#22d093]/[0.06]
                       hover:bg-[#22d093]/15 transition-all disabled:opacity-40 whitespace-nowrap">
            {confirming ? '…' : '✓ Confirm'}
          </button>
          {!showReject ? (
            <button onClick={() => setShowReject(true)}
              className="h-7 px-2.5 rounded-lg text-[11px] border border-[#ff8a7a]/30 text-[#ff8a7a] bg-[#ff8a7a]/[0.06]
                         hover:bg-[#ff8a7a]/15 transition-all whitespace-nowrap">
              ✗ Reject
            </button>
          ) : (
            <div className="flex flex-col gap-1 w-full">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                maxLength={256}
                className="h-7 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-[11px] text-white placeholder-[#6a6a6e] outline-none"
              />
              <div className="flex gap-1">
                <button onClick={handleReject} disabled={rejecting}
                  className="h-6 px-2 rounded text-[10px] border border-[#ff8a7a]/30 text-[#ff8a7a] bg-[#ff8a7a]/[0.06] hover:bg-[#ff8a7a]/15 disabled:opacity-40">
                  {rejecting ? '…' : 'Confirm Reject'}
                </button>
                <button onClick={() => setShowReject(false)}
                  className="h-6 px-2 rounded text-[10px] border border-white/[0.10] text-[#6a6a6e] hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {portalUrl && (
        <button onClick={handleCopyPortal}
          className="h-6 px-2 rounded text-[10px] border border-white/[0.10] text-[#6a6a6e] hover:text-white hover:bg-white/[0.04] transition-all text-left">
          {copied ? '✓ Copied!' : '⎘ Copy Portal Link'}
        </button>
      )}

      {/* Resend confirmation email */}
      {['pending', 'customer_confirmed'].includes(confirmationStatus) && hasCustomerEmail && portalToken && (
        <button onClick={handleResend} disabled={resending}
          className="h-6 px-2 rounded text-[10px] border border-[#3b9eff]/20 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40 text-left">
          {resending ? '…' : `↺ Resend Email${(resendCount ?? 0) > 0 ? ` (${resendCount})` : ''}`}
        </button>
      )}
    </div>
  )
}
