'use client'

import { useState, useMemo } from 'react'
import type { Booking } from '@/types'
import BookingActionsClient from './BookingActionsClient'
import BookingsFilterBar, { type BookingFilter } from './BookingsFilterBar'

type ExtBooking = Booking & {
  services?: { name: string } | null
  confirmation_status?: string
  customer_portal_token?: string
  owner_review_status?: string
  customer_confirmation_email_resend_count?: number
  customer_email?: string | null
  calcom_availability_status?: string | null
}

const STATUS_PILL: Record<string, string> = {
  pending:   'pill pill-amber',
  confirmed: 'pill pill-green',
  cancelled: 'pill pill-red',
  completed: 'pill pill-cyan',
  no_show:   'pill pill-mute',
}

const CONFIRM_PILL: Record<string, string> = {
  pending:            'text-[10px] px-2 py-0.5 rounded-full border border-[#ffae3c]/30 bg-[#ffae3c]/[0.08] text-[#ffae3c]',
  customer_confirmed: 'text-[10px] px-2 py-0.5 rounded-full border border-[#3b9eff]/30 bg-[#3b9eff]/[0.08] text-[#3b9eff]',
  owner_confirmed:    'text-[10px] px-2 py-0.5 rounded-full border border-[#3b9eff]/30 bg-[#3b9eff]/[0.08] text-[#3b9eff]',
  confirmed:          'text-[10px] px-2 py-0.5 rounded-full border border-[#22d093]/30 bg-[#22d093]/[0.08] text-[#22d093]',
  rejected:           'text-[10px] px-2 py-0.5 rounded-full border border-[#ff8a7a]/30 bg-[#ff8a7a]/[0.08] text-[#ff8a7a]',
  expired:            'text-[10px] px-2 py-0.5 rounded-full border border-white/[0.10] bg-white/[0.04] text-[#6a6a6e]',
}

const CONFIRM_LABELS: Record<string, string> = {
  pending:            '⏳ Awaiting',
  customer_confirmed: '✓ Customer confirmed',
  owner_confirmed:    '✓ Owner confirmed',
  confirmed:          '✅ Confirmed',
  rejected:           '✗ Rejected',
  expired:            '⏱ Expired',
}

interface Props {
  bookings:    ExtBooking[]
  rtConnected: boolean
  appUrl:      string
}

export default function BookingsPageClient({ bookings, rtConnected, appUrl }: Props) {
  const [filter, setFilter] = useState<BookingFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = bookings

    // Apply status filter
    if (filter === 'pending')             result = result.filter((b) => b.confirmation_status === 'pending')
    else if (filter === 'customer_confirmed') result = result.filter((b) => b.confirmation_status === 'customer_confirmed')
    else if (filter === 'owner_confirmed')    result = result.filter((b) => b.confirmation_status === 'owner_confirmed')
    else if (filter === 'confirmed')          result = result.filter((b) => b.confirmation_status === 'confirmed')
    else if (filter === 'rejected')           result = result.filter((b) => b.confirmation_status === 'rejected')
    else if (filter === 'expired')            result = result.filter((b) => b.confirmation_status === 'expired')
    else if (filter === 'needs_review')       result = result.filter((b) => b.owner_review_status === 'pending' && !['confirmed','rejected','expired'].includes(b.confirmation_status ?? ''))
    else if (filter === 'availability_failed') result = result.filter((b) => b.calcom_availability_status === 'failed' || b.calcom_availability_status === 'unavailable')

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((b) =>
        (b.customer_name ?? '').toLowerCase().includes(q) ||
        (b.services?.name ?? '').toLowerCase().includes(q) ||
        (b.status ?? '').toLowerCase().includes(q)
      )
    }

    return result
  }, [bookings, filter, search])

  if (bookings.length === 0) {
    return (
      <div className="border border-white/10 rounded-2xl p-12 text-center">
        <div className="text-4xl mb-3">◷</div>
        <h3 className="text-[18px] font-semibold mb-2">No bookings yet</h3>
        <p className="text-[14px] text-[#9a9a9d]">
          Bookings will appear here once your AI assistant confirms appointments.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Live badge */}
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
          rtConnected
            ? 'border-[#22d093]/30 bg-[#22d093]/[0.06] text-[#22d093]'
            : 'border-white/[0.08] bg-white/[0.02] text-[#6a6a6e]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${rtConnected ? 'bg-[#22d093] animate-pulse' : 'bg-[#6a6a6e]'}`} />
          {rtConnected ? 'Live' : 'Loading…'}
        </span>
        <span className="text-[11.5px] text-[#6a6a6e]">{filtered.length} of {bookings.length} shown</span>
      </div>

      <BookingsFilterBar active={filter} onChange={setFilter} search={search} onSearch={setSearch} />

      {filtered.length === 0 ? (
        <div className="border border-white/[0.07] rounded-2xl p-8 text-center">
          <p className="text-[13px] text-[#6a6a6e]">No bookings match this filter.</p>
        </div>
      ) : (
        <div className="border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="helios-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Confirmation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const confStatus = b.confirmation_status ?? 'pending'
                  const portalUrl  = b.customer_portal_token ? `${appUrl}/booking/${b.customer_portal_token}` : null
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="font-medium text-white">{b.customer_name ?? '—'}</div>
                        {b.customer_email && (
                          <div className="text-[11px] text-[#6a6a6e]">{b.customer_email.slice(0, 3)}***</div>
                        )}
                      </td>
                      <td className="text-[#9a9a9d]">{b.services?.name ?? '—'}</td>
                      <td className="font-mono text-[12.5px] text-[#9a9a9d] whitespace-nowrap">
                        {b.scheduled_at
                          ? new Date(b.scheduled_at).toLocaleString(undefined, {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td>
                        <span className={STATUS_PILL[b.status] ?? 'pill pill-mute'}>{b.status}</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={CONFIRM_PILL[confStatus] ?? CONFIRM_PILL.pending}>
                            {CONFIRM_LABELS[confStatus] ?? confStatus}
                          </span>
                          {b.calcom_availability_status && b.calcom_availability_status !== 'available' && b.calcom_availability_status !== 'skipped' && (
                            <span className="text-[10px] text-[#ffae3c]">Cal.com: {b.calcom_availability_status}</span>
                          )}
                          {portalUrl && (
                            <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                               className="text-[10px] text-[#6a6a6e] hover:text-white underline">
                              Portal →
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <BookingActionsClient
                          bookingId={b.id}
                          confirmationStatus={confStatus}
                          portalToken={b.customer_portal_token ?? null}
                          portalUrl={portalUrl}
                          hasCustomerEmail={!!b.customer_email}
                          resendCount={b.customer_confirmation_email_resend_count ?? 0}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
