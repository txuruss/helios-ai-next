import type { SystemHealthItem } from '@/lib/actions/ops'

interface Props {
  items: SystemHealthItem[]
}

const STATUS_CONFIG = {
  healthy:      { dot: 'bg-[#22d093]', label: 'Healthy',      text: 'text-[#22d093]' },
  degraded:     { dot: 'bg-[#ffae3c]', label: 'Degraded',     text: 'text-[#ffae3c]' },
  unconfigured: { dot: 'bg-[#6a6a6e]', label: 'Not set',      text: 'text-[#6a6a6e]' },
  unknown:      { dot: 'bg-[#4a4a4e]', label: 'Unknown',      text: 'text-[#4a4a4e]' },
}

const SYSTEM_ICON: Record<string, string> = {
  'Chat Widget':    '🌐',
  'Anthropic AI':   '🤖',
  'Cal.com':        '📅',
  'WhatsApp':       '✆',
  'Stripe':         '💳',
  'Relevance AI':   '⚡',
  'PostHog':        '📊',
  'Sentry':         '🛡',
}

export default function ClientSystemHealth({ items }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-4">
        System Health
      </div>
      {items.length === 0 ? (
        <p className="text-[12px] text-[#6a6a6e] py-4">No systems found.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => {
            const cfg = STATUS_CONFIG[item.status]
            return (
              <div key={item.name} className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[16px]">{SYSTEM_ICON[item.name] ?? '⚙'}</span>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[12.5px] font-medium text-white">{item.name}</p>
                  <p className="text-[11px] text-[#6a6a6e] mt-0.5 truncate">{item.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
