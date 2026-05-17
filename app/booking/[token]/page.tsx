import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getBookingPortalByToken } from '@/lib/bookings/confirmation'
import BookingPortalClient from './BookingPortalClient'

export const metadata: Metadata = { title: 'Booking Confirmation — Helios AI' }

interface Props {
  params: Promise<{ token: string }>
}

const STATUS_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  pending:            { label: 'Awaiting Confirmation',  color: '#ffae3c', emoji: '⏳' },
  customer_confirmed: { label: 'You Confirmed',          color: '#3b9eff', emoji: '✓'  },
  owner_confirmed:    { label: 'Business Confirmed',     color: '#3b9eff', emoji: '✓'  },
  confirmed:          { label: 'Booking Confirmed',      color: '#22d093', emoji: '✅' },
  rejected:           { label: 'Booking Rejected',       color: '#ff8a7a', emoji: '✗'  },
  expired:            { label: 'Link Expired',           color: '#6a6a6e', emoji: '⏱'  },
}

export default async function BookingPortalPage({ params }: Props) {
  const { token } = await params

  if (!token || token.length < 32) notFound()

  const { booking, expired, error } = await getBookingPortalByToken(token)

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
        <div className="max-w-[420px] w-full border border-white/[0.08] rounded-2xl p-8 bg-[#0f1012] text-center">
          <div className="text-[32px] mb-4">🔍</div>
          <h1 className="text-[20px] font-semibold text-white mb-2">Booking not found</h1>
          <p className="text-[14px] text-[#9a9a9d]">
            This booking link is invalid or has expired. Please contact the business directly.
          </p>
        </div>
      </div>
    )
  }

  if (!booking) notFound()

  const statusMeta = STATUS_LABELS[booking.confirmation_status] ?? STATUS_LABELS.pending
  const showActions = ['pending', 'owner_confirmed'].includes(booking.confirmation_status) && !expired

  const scheduledDate = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : null
  const scheduledTime = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
      <div className="max-w-[480px] w-full">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-[8px] bg-[#ff7a18] flex items-center justify-center text-[14px]">⚙</div>
          <span className="text-[15px] font-semibold text-white">
            {booking.business_name ?? 'Helios AI'}
          </span>
        </div>

        {/* Card */}
        <div className="border border-white/[0.08] rounded-2xl p-7 bg-[#0f1012]">
          {/* Status */}
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-[24px]">{statusMeta.emoji}</span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]">Status</p>
              <p className="text-[16px] font-semibold" style={{ color: statusMeta.color }}>
                {statusMeta.label}
              </p>
            </div>
          </div>

          {/* Booking details */}
          <div className="flex flex-col gap-3 border-y border-white/[0.06] py-5 mb-5">
            {booking.service_name && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-[#6a6a6e] uppercase tracking-[0.08em]">Service</span>
                <span className="text-[13.5px] text-white font-medium">{booking.service_name}</span>
              </div>
            )}
            {scheduledDate && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-[#6a6a6e] uppercase tracking-[0.08em]">Date</span>
                <span className="text-[13.5px] text-white font-medium">{scheduledDate}</span>
              </div>
            )}
            {scheduledTime && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-[#6a6a6e] uppercase tracking-[0.08em]">Time</span>
                <span className="text-[13.5px] text-white font-medium">{scheduledTime}</span>
              </div>
            )}
          </div>

          {/* Rejection reason */}
          {booking.confirmation_status === 'rejected' && booking.rejection_reason && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.05]">
              <p className="text-[12.5px] text-[#ff8a7a]">{booking.rejection_reason}</p>
            </div>
          )}

          {/* Expired notice */}
          {expired && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.05]">
              <p className="text-[12.5px] text-[#ffae3c]">
                This booking link has expired. Please contact the business to reschedule.
              </p>
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <BookingPortalClient token={token} bookingId={booking.id} />
          )}

          {/* Confirmed notice */}
          {booking.confirmation_status === 'confirmed' && (
            <div className="px-4 py-3 rounded-xl border border-[#22d093]/20 bg-[#22d093]/[0.05]">
              <p className="text-[12.5px] text-[#22d093]">
                Your booking is confirmed! You should receive a confirmation from the business shortly.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#6a6a6e] mt-6">
          Powered by{' '}
          <Link href="/" className="text-[#ffae3c] hover:underline">Helios AI</Link>
        </p>
      </div>
    </div>
  )
}
