import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import CalcomClient from './CalcomClient'
import ServiceMappingForm from './ServiceMappingForm'
import AvailabilityTester from './AvailabilityTester'
import type { Service } from '@/types'

export default async function CalcomPage() {
  // Guard: SUPABASE_SERVICE_ROLE_KEY is required for all server-side DB writes on this page.
  // Show a safe config warning instead of crashing with an unhandled error.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <>
        <PageHeader
          eyebrow="Cal.com Integration"
          title="Cal.com"
          description="Sync event types, map services, test availability, and manage bookings."
        />
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-[#ff6a5a]/30 bg-[#ff6a5a]/[0.06]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff8a7a" strokeWidth="2.2" strokeLinecap="round" className="shrink-0">
            <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <div>
            <p className="text-[14px] font-semibold text-[#ff8a7a]">Server configuration is incomplete.</p>
            <p className="text-[13px] text-[#9a9a9d] mt-0.5">
              Add <code className="font-mono text-[#5be3c5]">SUPABASE_SERVICE_ROLE_KEY</code> to{' '}
              <code className="font-mono text-[#5be3c5]">.env.local</code> and restart the dev server to enable Cal.com sync.
            </p>
          </div>
        </div>
      </>
    )
  }

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const db = createServiceRoleClient()

  const { data: membership } = user
    ? await db
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
    : { data: null }

  const businessId = (membership as { business_id: string } | null)?.business_id ?? null
  const apiKeyConfigured = !!process.env.CALCOM_API_KEY

  // Load all data in parallel
  const [servicesRes, eventTypesRes, mappingsRes, connectionRes] = businessId
    ? await Promise.all([
        db.from('services').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name'),
        db.from('calcom_event_types').select('id, calcom_id, title, slug, duration_min, is_active').eq('business_id', businessId).order('title'),
        db.from('service_event_mappings').select('id, service_id, calcom_event_type_id').eq('business_id', businessId),
        db.from('calcom_connections').select('last_synced_at').eq('business_id', businessId).single(),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: null }]

  const services   = (servicesRes.data   ?? []) as Pick<Service, 'id' | 'name'>[]
  const eventTypes = (eventTypesRes.data ?? []) as {
    id: string; calcom_id: number | null; title: string; slug: string | null; duration_min: number | null; is_active: boolean
  }[]
  const mappings = (mappingsRes.data ?? []) as { id: string; service_id: string; calcom_event_type_id: string | null }[]
  const lastSynced = (connectionRes.data as { last_synced_at: string | null } | null)?.last_synced_at ?? null

  // Services that have a mapping (for availability tester)
  const mappedServiceIds = new Set(mappings.map((m) => m.service_id))
  const mappedServices = services.filter((s) => mappedServiceIds.has(s.id))

  return (
    <>
      <PageHeader
        eyebrow="Cal.com Integration"
        title="Cal.com"
        description="Sync event types, map services, test availability, and manage bookings."
      />

      {!businessId && (
        <div className="mb-6 px-5 py-4 rounded-xl bg-[#ffae3c]/10 border border-[#ffae3c]/30 text-[13.5px] text-[#ffae3c]">
          Set up your business profile first to enable Cal.com integration.
        </div>
      )}

      {businessId && (
        <>
          {/* API key status + sync button */}
          <CalcomClient
            eventTypes={eventTypes}
            apiKeyConfigured={apiKeyConfigured}
            lastSynced={lastSynced}
          />

          {/* Service mapping */}
          <div className="mb-5">
            <ServiceMappingForm
              services={services}
              eventTypes={eventTypes}
              mappings={mappings}
            />
          </div>

          {/* Availability tester — only shown when at least one mapping exists */}
          {mappedServices.length > 0 && (
            <div className="mb-5">
              <AvailabilityTester services={mappedServices} businessId={businessId} />
            </div>
          )}

          {/* Recent bookings from Supabase */}
          <RecentBookings businessId={businessId} db={db} />
        </>
      )}
    </>
  )
}

// ── Recent bookings section ───────────────────────────────────────

async function RecentBookings({
  businessId,
  db,
}: {
  businessId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
}) {
  const { data: bookings } = await db
    .from('bookings')
    .select('id, customer_name, customer_email, scheduled_at, status, calcom_booking_uid')
    .eq('business_id', businessId)
    .not('calcom_booking_uid', 'is', null)
    .order('scheduled_at', { ascending: false })
    .limit(10)

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h3 className="text-[15px] font-semibold">Cal.com Bookings</h3>
        <p className="text-[13px] text-[#9a9a9d] mt-0.5">Recent bookings created through Cal.com.</p>
      </div>

      {!bookings || bookings.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-[13.5px] text-[#6a6a6e]">No Cal.com bookings yet.</p>
        </div>
      ) : (
        <table className="helios-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Date & Time</th>
              <th>Status</th>
              <th>Cal.com UID</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b: {
              id: string
              customer_name: string | null
              customer_email: string | null
              scheduled_at: string | null
              status: string
              calcom_booking_uid: string | null
            }) => (
              <tr key={b.id}>
                <td>
                  <div className="font-medium text-white">{b.customer_name ?? '—'}</div>
                  {b.customer_email && (
                    <div className="text-[12px] text-[#6a6a6e]">{b.customer_email}</div>
                  )}
                </td>
                <td className="font-mono text-[12.5px] text-[#9a9a9d] whitespace-nowrap">
                  {b.scheduled_at
                    ? new Date(b.scheduled_at).toLocaleString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td>
                  <span className={`pill ${
                    b.status === 'confirmed' ? 'pill-green'
                    : b.status === 'cancelled' ? 'pill-red'
                    : 'pill-amber'
                  }`}>
                    {b.status}
                  </span>
                </td>
                <td className="font-mono text-[11.5px] text-[#6a6a6e] truncate max-w-[140px]">
                  {b.calcom_booking_uid ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
