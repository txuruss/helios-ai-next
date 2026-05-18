import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_OUTREACH } from '@/lib/data/mock-team'

const STATUS_TONE: Record<string, string> = {
  active:    '#22d093',
  paused:    '#ffae3c',
  completed: '#6a6a6e',
}

export default async function TeamOutreachPage() {
  await requireTeam({ path: '/team/outreach' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Outreach</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Internal outreach campaigns and performance.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MOCK_OUTREACH.map((c) => {
          const color = STATUS_TONE[c.status]
          const replyRate = c.sent ? ((c.replied / c.sent) * 100).toFixed(1) : '0'
          const mtgRate   = c.sent ? ((c.meetings / c.sent) * 100).toFixed(1) : '0'
          return (
            <div key={c.id} className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold">{c.campaign}</div>
                  <div className="text-[12px] text-[#6a6a6e] capitalize">{c.channel}</div>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize"
                  style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                  {c.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Sent"     value={String(c.sent)} />
                <Stat label="Replied"  value={`${c.replied} (${replyRate}%)`} />
                <Stat label="Meetings" value={`${c.meetings} (${mtgRate}%)`} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</div>
      <div className="text-[14px] font-semibold text-white mt-0.5">{value}</div>
    </div>
  )
}
