import Link from 'next/link'

interface Props {
  plan:          string
  conversations: number
  leads:         number
  bookings:      number
  limits: {
    ai_conversations_month: number
    leads_month:            number
    bookings_month:         number
  }
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct     = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const isWarn  = pct >= 80
  const isDanger = pct >= 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-[#9a9a9d]">{label}</span>
        <span className={isDanger ? 'text-[#ff8a7a]' : isWarn ? 'text-[#ffae3c]' : 'text-[#6a6a6e]'}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isDanger ? 'bg-[#ff8a7a]' : isWarn ? 'bg-[#ffae3c]' : 'bg-[#22d093]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function PlanUsageCard({ plan, conversations, leads, bookings, limits }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">
          Plan & Usage — This Month
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[#ffae3c] capitalize">{plan}</span>
          <Link
            href="/dashboard/settings/billing"
            className="text-[11px] px-2 py-1 rounded-lg border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08]
                       text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all"
          >
            Upgrade
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <UsageBar label="AI Conversations" used={conversations} limit={limits.ai_conversations_month} />
        <UsageBar label="Leads"            used={leads}         limit={limits.leads_month} />
        <UsageBar label="Bookings"         used={bookings}      limit={limits.bookings_month} />
      </div>
    </div>
  )
}
