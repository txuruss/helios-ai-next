export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'orange'

const TONE: Record<KpiTone, { border: string; bg: string; value: string; sub: string }> = {
  neutral: { border: 'border-white/[0.08]',     bg: 'bg-[#0f1012]/80',         value: 'text-white',     sub: 'text-[#6a6a6e]'     },
  success: { border: 'border-[#22d093]/20',      bg: 'bg-[#22d093]/[0.04]',     value: 'text-[#22d093]', sub: 'text-[#22d093]/60'  },
  warning: { border: 'border-[#ffae3c]/25',      bg: 'bg-[#ffae3c]/[0.04]',     value: 'text-[#ffae3c]', sub: 'text-[#ffae3c]/60'  },
  danger:  { border: 'border-[#ff8a7a]/25',      bg: 'bg-[#ff8a7a]/[0.04]',     value: 'text-[#ff8a7a]', sub: 'text-[#ff8a7a]/60'  },
  info:    { border: 'border-[#3b9eff]/20',      bg: 'bg-[#3b9eff]/[0.04]',     value: 'text-[#3b9eff]', sub: 'text-[#3b9eff]/60'  },
  orange:  { border: 'border-[#ff7a18]/25',      bg: 'bg-[#ff7a18]/[0.04]',     value: 'text-[#ffae3c]', sub: 'text-[#ffae3c]/60'  },
}

interface AdminKpiCardProps {
  label:     string
  value:     string | number
  sublabel?: string
  tone?:     KpiTone
  note?:     string
}

export default function AdminKpiCard({
  label, value, sublabel, tone = 'neutral', note,
}: AdminKpiCardProps) {
  const t = TONE[tone]
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-4 flex flex-col gap-1 min-w-0`}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e] truncate">
        {label}
      </div>
      <div className={`text-[22px] font-bold leading-none mt-1 tabular-nums ${t.value}`}>
        {value}
      </div>
      {sublabel && (
        <div className={`text-[11px] mt-0.5 ${t.sub}`}>{sublabel}</div>
      )}
      {note && (
        <div className="text-[10px] text-[#6a6a6e]/70 mt-0.5 italic">{note}</div>
      )}
    </div>
  )
}
