import { Metadata } from 'next'
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

function InvalidLinkPage({ reason }: { reason: 'invalid' | 'expired' | 'not_found' }) {
  const copy = {
    invalid:   { icon: '🔗', title: 'Invalid booking link',   body: 'This booking link is not valid. Please check the link in your email or contact the business directly.' },
    expired:   { icon: '⏱',  title: 'This link has expired',  body: 'This booking confirmation link has expired. Please contact the business to reschedule or get a new link.' },
    not_found: { icon: '🔍', title: 'Booking not found',       body: 'This booking link is invalid or has already expired. Please contact the business directly.' },
  }[reason]

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6">
      <div className="max-w-[440px] w-full">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-[8px] bg-[#ff7a18] flex items-center justify-center text-[14px]">⚙</div>
          <span className="text-[15px] font-semibold text-white">Helios AI</span>
        </div>

        <div className="border border-white/[0.08] rounded-2xl p-8 bg-[#0f1012] text-center">
          <div className="text-[40px] mb-4">{copy.icon}</div>
          <h1 className="text-[20px] font-semibold text-white mb-3">{copy.title}</h1>
          <p className="text-[14px] text-[#9a9a9d] leading-relaxed mb-6">{copy.body}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] text-[13.5px] font-medium
                       bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity"
          >
            Go to Helios AI
          </Link>
        </div>

        <p className="text-center text-[11px] text-[#6a6a6e] mt-6">
          Powered by{' '}
          <Link href="/" className="text-[#ffae3c] hover:underline">Helios AI</Link>
        </p>
      </div>
    </div>
  )
}

export default async function BookingPortalPage({ params }: Props) {
  const { token } = await params

  // Short or obviously invalid token — render styled page, not Next.js 404
  if (!token || token.length < 16) {
    return <InvalidLinkPage reason="invalid" />
  }

  const { booking, expired, error } = await getBookingPortalByToken(token)

  // Token not found in DB, lookup error, or no matching booking
  if (!booking) {
    return <InvalidLinkPage reason="not_found" />
  }

  // Token found but already expired
  if (expired || booking.confirmation_status === 'expired') {
    return <InvalidLinkPage reason="expired" />
  }

  const statusMeta  = STATUS_LABELS[booking.confirmation_status] ?? STATUS_LABELS.pending
  const showActions = ['pending', 'owner_confirmed'].includes(booking.confirmation_status)

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
        {/* Brand / business name */}
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

          {/* Actions for pending/owner_confirmed bookings */}
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

          {/* Rejected final state */}
          {booking.confirmation_status === 'rejected' && (
            <div className="px-4 py-3 rounded-xl border border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.05]">
              <p className="text-[12.5px] text-[#ff8a7a]">
                This booking request was not accepted. Please contact the business to make a new request.
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
