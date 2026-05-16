import type { SlaSummary } from '@/lib/ops/sla'

interface Props {
  summary: SlaSummary
}

export default function SlaSummaryCards({ summary }: Props) {
  const cards = [
    { label: 'Breached',  value: summary.breached,  color: 'text-[#ff8a7a]', bg: 'border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.04]', icon: '🔴' },
    { label: 'Due Soon',  value: summary.due_soon,  color: 'text-[#ff7a18]', bg: 'border-[#ff7a18]/20 bg-[#ff7a18]/[0.04]', icon: '⏰' },
    { label: 'Escalated', value: summary.escalated, color: 'text-[#c084fc]', bg: 'border-[#c084fc]/20 bg-[#c084fc]/[0.04]', icon: '🔺' },
    { label: 'On Track',  value: summary.on_track,  color: 'text-[#22d093]', bg: 'border-[#22d093]/20 bg-[#22d093]/[0.04]', icon: '✅' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-2xl border p-4 flex flex-col gap-2 ${c.bg}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">{c.label}</span>
            <span className="text-[16px]">{c.icon}</span>
          </div>
          <span className={`text-[32px] font-semibold leading-none ${c.color}`}>{c.value}</span>
          <span className="text-[11.5px] text-[#6a6a6e]">items</span>
        </div>
      ))}
    </div>
  )
}
