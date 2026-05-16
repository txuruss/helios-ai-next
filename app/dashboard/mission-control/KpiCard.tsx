interface Props {
  label:      string
  value:      string | number
  sub?:       string
  delta?:     string
  deltaDir?:  'up' | 'down' | 'warn' | 'neutral'
  variant?:   'default' | 'warn' | 'danger' | 'success'
  icon?:      string
  href?:      string
}

const VARIANT_STYLES = {
  default: 'border-white/[0.07] bg-[#0f1012]',
  warn:    'border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]',
  danger:  'border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.04]',
  success: 'border-[#22d093]/20 bg-[#22d093]/[0.04]',
}

const DELTA_STYLES = {
  up:      'text-[#22d093]',
  down:    'text-[#ff8a7a]',
  warn:    'text-[#ffae3c]',
  neutral: 'text-[#6a6a6e]',
}

export default function KpiCard({ label, value, sub, delta, deltaDir = 'neutral', variant = 'default', icon }: Props) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${VARIANT_STYLES[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">{label}</span>
        {icon && <span className="text-[16px]">{icon}</span>}
      </div>
      <div className="text-[28px] font-semibold tracking-tight text-white leading-none">{value}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {sub && <span className="text-[11.5px] text-[#6a6a6e]">{sub}</span>}
        {delta && (
          <span className={`text-[11px] font-medium ${DELTA_STYLES[deltaDir]}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}
