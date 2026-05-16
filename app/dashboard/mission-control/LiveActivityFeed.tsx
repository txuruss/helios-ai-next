import type { OpsEvent } from '@/lib/actions/ops'

interface Props {
  events: OpsEvent[]
}

const SOURCE_ICON: Record<string, string> = {
  chat:       '💬',
  whatsapp:   '✆',
  calcom:     '📅',
  stripe:     '💳',
  relevance:  '🤖',
  system:     '⚙',
  widget:     '🌐',
}

const SEVERITY_DOT: Record<string, string> = {
  info:     'bg-[#22d093]',
  warning:  'bg-[#ffae3c]',
  error:    'bg-[#ff8a7a]',
  critical: 'bg-[#ff4444]',
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function LiveActivityFeed({ events }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">
          Live Activity
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22d093] animate-pulse" />
          <span className="text-[10px] text-[#6a6a6e]">Auto-logged</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="text-[20px]">📊</span>
          <p className="text-[12.5px] text-white font-medium">No activity yet</p>
          <p className="text-[11.5px] text-[#6a6a6e]">Events will appear here as your system runs.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="relative mt-1 shrink-0">
                <span className={`w-2 h-2 rounded-full block ${SEVERITY_DOT[ev.severity] ?? 'bg-[#9a9a9d]'}`} />
              </div>
              <div className="w-7 text-center text-[14px] shrink-0">
                {SOURCE_ICON[ev.source] ?? '•'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white leading-snug">{ev.title}</p>
                {ev.description && (
                  <p className="text-[11.5px] text-[#9a9a9d] mt-0.5 truncate">{ev.description}</p>
                )}
                <p className="text-[10.5px] text-[#6a6a6e] mt-0.5 capitalize">{ev.source} · {ev.event_type}</p>
              </div>
              <span className="text-[10.5px] text-[#6a6a6e] font-mono shrink-0 mt-0.5">{relTime(ev.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
