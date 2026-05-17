'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { capture } from '@/lib/analytics/posthog'
import type { Booking } from '@/types'

type ExtBooking = Booking & {
  services?: { name: string } | null
  confirmation_status?: string
  customer_portal_token?: string
  owner_review_status?: string
  customer_confirmation_email_resend_count?: number
}

interface Props {
  businessId: string
  children: (params: {
    bookings:    ExtBooking[]
    rtConnected: boolean
  }) => React.ReactNode
  initialBookings: ExtBooking[]
}

export default function BookingsRealtimeClient({ businessId, children, initialBookings }: Props) {
  const [bookings,    setBookings]    = useState<ExtBooking[]>(initialBookings)
  const [rtConnected, setRtConnected] = useState(false)

  useEffect(() => {
    if (!businessId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`bookings:${businessId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'bookings',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          capture('booking_realtime_update_received', { event: payload.eventType })
          setBookings((prev) => {
            if (payload.eventType === 'INSERT') {
              const newRow = payload.new as ExtBooking
              return [newRow, ...prev]
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((b) =>
                b.id === (payload.new as ExtBooking).id
                  ? { ...b, ...(payload.new as ExtBooking) }
                  : b
              )
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((b) => b.id !== (payload.old as { id: string }).id)
            }
            return prev
          })
        },
      )
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED'
        setRtConnected(connected)
        if (connected) capture('booking_realtime_connected', {})
      })

    return () => { void supabase.removeChannel(channel) }
  }, [businessId])

  return <>{children({ bookings, rtConnected })}</>
}
