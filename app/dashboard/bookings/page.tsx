import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import type { Booking } from '@/types'
import BookingActionsClient from './BookingActionsClient'

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

export default async function BookingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('business_members').select('business_id').eq('user_id', user?.id ?? '').limit(1).single()

  const { data: bookings } = membership
    ? await supabase
        .from('bookings')
        .select('*, services(name)')
        .eq('business_id', membership.business_id)
        .order('scheduled_at', { ascending: true })
        .limit(50)
    : { data: [] as (Booking & { services?: { name: string } | null })[] }

  return (
    <>
      <PageHeader
        eyebrow="Booking Calendar"
        title="Bookings"
        description="All upcoming and past bookings managed through your AI system."
        action={
          <button className="btn-ghost btn-sm">+ Manual Booking</button>
        }
      />

      {!bookings || bookings.length === 0 ? (
        <div className="border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">◷</div>
          <h3 className="text-[18px] font-semibold mb-2">No bookings yet</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">
            Bookings will appear here once your AI assistant confirms appointments.
            Connect Cal.com in Phase 2 to enable real bookings.
          </p>
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
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Confirmation</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const bExt = b as Booking & { services?: { name: string } | null; confirmation_status?: string; customer_portal_token?: string }
                  const confStatus = bExt.confirmation_status ?? 'pending'
                  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
                  const portalUrl = bExt.customer_portal_token ? `${appUrl}/booking/${bExt.customer_portal_token}` : null
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="font-medium text-white">{b.customer_name ?? '—'}</div>
                        {b.customer_email && (
                          <div className="text-[12px] text-[#6a6a6e]">{b.customer_email}</div>
                        )}
                      </td>
                      <td className="text-[#9a9a9d]">
                        {bExt.services?.name ?? '—'}
                      </td>
                      <td className="font-mono text-[12.5px] text-[#9a9a9d] whitespace-nowrap">
                        {b.scheduled_at
                          ? new Date(b.scheduled_at).toLocaleString(undefined, {
                              weekday: 'short', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="text-[#9a9a9d]">
                        {b.duration_min ? `${b.duration_min} min` : '—'}
                      </td>
                      <td>
                        <span className={STATUS_PILL[b.status] ?? 'pill pill-mute'}>{b.status}</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={CONFIRM_PILL[confStatus] ?? CONFIRM_PILL.pending}>
                            {CONFIRM_LABELS[confStatus] ?? confStatus}
                          </span>
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
                          portalToken={bExt.customer_portal_token ?? null}
                          portalUrl={portalUrl}
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

      <div className="mt-6 p-5 rounded-2xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1.5">Phase 2 — Cal.com</div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Connect your Cal.com account in <strong className="text-white">/dashboard/calcom</strong> to sync
          bookings with your real calendar and allow live availability checking.
        </p>
      </div>
    </>
  )
}
