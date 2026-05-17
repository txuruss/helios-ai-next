import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import type { Booking } from '@/types'
import BookingActionsClient from './BookingActionsClient'
import BookingsRealtimeClient from './BookingsRealtimeClient'
import BookingsPageClient from './BookingsPageClient'

export default async function BookingsPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const { data: membership } = user
    ? await authClient.from('business_members').select('business_id').eq('user_id', user?.id ?? '').limit(1).single()
    : { data: null }

  const businessId = (membership as { business_id?: string } | null)?.business_id ?? null

  type ExtBooking = Booking & {
    services?: { name: string } | null
    confirmation_status?: string
    customer_portal_token?: string
    owner_review_status?: string
    customer_confirmation_email_resend_count?: number
    customer_email?: string | null
  }

  let bookings: ExtBooking[] = []

  if (businessId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createServiceRoleClient()
    const { data } = await db
      .from('bookings')
      .select('*, services(name)')
      .eq('business_id', businessId)
      .order('scheduled_at', { ascending: true })
      .limit(100)
    bookings = (data ?? []) as ExtBooking[]
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <>
      <PageHeader
        eyebrow="Booking Calendar"
        title="Bookings"
        description="All upcoming and past bookings managed through your AI system."
        action={<button className="btn-ghost btn-sm">+ Manual Booking</button>}
      />

      {businessId ? (
        <BookingsRealtimeClient businessId={businessId} initialBookings={bookings}>
          {({ bookings: liveBookings, rtConnected }) => (
            <BookingsPageClient
              bookings={liveBookings}
              rtConnected={rtConnected}
              appUrl={appUrl}
            />
          )}
        </BookingsRealtimeClient>
      ) : (
        <div className="border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">◷</div>
          <h3 className="text-[18px] font-semibold mb-2">No bookings yet</h3>
          <p className="text-[14px] text-[#9a9a9d]">
            Bookings will appear here once your AI assistant confirms appointments.
          </p>
        </div>
      )}

      <div className="mt-6 p-5 rounded-2xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1.5">Cal.com Booking</div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Connect Cal.com in <strong className="text-white">/dashboard/calcom</strong> to sync bookings with your real calendar.
        </p>
      </div>
    </>
  )
}

// Re-export for type sharing
export type { BookingActionsClient }
