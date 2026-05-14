import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import type { Booking } from '@/types'

const STATUS_PILL: Record<string, string> = {
  pending:   'pill pill-amber',
  confirmed: 'pill pill-green',
  cancelled: 'pill pill-red',
  completed: 'pill pill-cyan',
  no_show:   'pill pill-mute',
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="font-medium text-white">{b.customer_name ?? '—'}</div>
                      {b.customer_email && (
                        <div className="text-[12px] text-[#6a6a6e]">{b.customer_email}</div>
                      )}
                    </td>
                    <td className="text-[#9a9a9d]">
                      {(b as Booking & { services?: { name: string } | null }).services?.name ?? '—'}
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
                      <button className="h-7 px-3 rounded-lg text-[12px] border border-white/10 bg-white/[0.02]
                                          text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
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
