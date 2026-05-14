import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import type { Service } from '@/types'

function priceFmt(cents: number | null) {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('business_members').select('business_id').eq('user_id', user?.id ?? '').limit(1).single()

  const { data: services } = membership
    ? await supabase.from('services').select('*').eq('business_id', membership.business_id).order('sort_order')
    : { data: [] as Service[] }

  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Services"
        description="Define the services your AI assistant can book and answer questions about."
        action={
          <button className="btn-primary btn-sm">
            + Add Service
          </button>
        }
      />

      {!services || services.length === 0 ? (
        <div className="border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">✦</div>
          <h3 className="text-[18px] font-semibold mb-2">No services yet</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Add the services you offer so your AI assistant can book them.</p>
          <button className="btn-primary btn-sm">Add Your First Service</button>
        </div>
      ) : (
        <div className="border border-white/10 rounded-2xl overflow-hidden">
          <table className="helios-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s: Service) => (
                <tr key={s.id}>
                  <td>
                    <div className="font-medium text-white">{s.name}</div>
                    {s.description && <div className="text-[12px] text-[#6a6a6e] mt-0.5">{s.description}</div>}
                  </td>
                  <td className="font-mono text-[#ffae3c]">{priceFmt(s.price_cents)}</td>
                  <td className="text-[#9a9a9d]">{s.duration_min ? `${s.duration_min} min` : '—'}</td>
                  <td>
                    <span className={`pill ${s.is_active ? 'pill-green' : 'pill-mute'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="h-7 px-3 rounded-lg text-[12px] border border-white/10 bg-white/[0.02]
                                        text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-5 rounded-2xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1.5">
          Phase 2 — Cal.com mapping
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Each service will be mappable to a Cal.com event type in{' '}
          <strong className="text-white">/dashboard/calcom</strong> so your AI assistant can create real bookings.
        </p>
      </div>
    </>
  )
}
