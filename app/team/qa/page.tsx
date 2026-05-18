import { requireTeam } from '@/lib/auth/require-team'

const QA_CHECKS = [
  { area: 'Website chat',     status: 'green',  detail: 'Widget loads, AI replies, lead capture working' },
  { area: 'WhatsApp',         status: 'amber',  detail: 'Template approval pending for 1 client'         },
  { area: 'Cal.com',          status: 'green',  detail: 'Event types live for 3 clients'                 },
  { area: 'Owner notifications', status: 'green', detail: 'Email + push delivery healthy'                },
  { area: 'Booking confirmations', status: 'green', detail: 'All recent bookings confirmed'              },
]

const TONE: Record<string, string> = { green: '#22d093', amber: '#ffae3c', red: '#ff8a7a' }

export default async function TeamQAPage() {
  await requireTeam({ path: '/team/qa' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">QA</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">System-wide QA checks across all client installations.</p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {QA_CHECKS.map((c) => (
            <div key={c.area} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TONE[c.status] }} />
                <div className="min-w-0">
                  <div className="text-[14px] text-white">{c.area}</div>
                  <div className="text-[12px] text-[#9a9a9d]">{c.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
