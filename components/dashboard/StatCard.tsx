import { cn } from '@/components/ui/cn'

type Variant = 'default' | 'warn' | 'danger' | 'success'

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaDir?: 'up' | 'down' | 'neutral' | 'warn' | 'bad'
  sub?: string
  variant?: Variant
}

const variantStyles: Record<Variant, string> = {
  default: 'border-white/10 bg-[#0f1012]/60',
  warn:    'border-[#ffb547]/25 bg-[#ffb547]/[0.04]',
  danger:  'border-[#ff6a5a]/25 bg-[#ff6a5a]/[0.04]',
  success: 'border-[#22d093]/25 bg-[#22d093]/[0.04]',
}

const deltaStyles: Record<string, string> = {
  up:      'text-[#22d093]',
  down:    'text-[#ff6a5a]',
  neutral: 'text-[#9a9a9d]',
  warn:    'text-[#ffb547]',
  bad:     'text-[#ff6a5a]',
}

export default function StatCard({ label, value, delta, deltaDir = 'neutral', sub, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn(
      'stat-card rounded-2xl border p-5 flex flex-col gap-2',
      variantStyles[variant],
    )}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]">
        {label}
      </div>
      <div className="text-[36px] font-semibold tabular-nums leading-none">{value}</div>
      {delta && (
        <div className={cn('text-[12px] font-medium', deltaStyles[deltaDir])}>
          {deltaDir === 'up' ? '↑ ' : ''}{delta}
        </div>
      )}
      {sub && <div className="text-[12px] text-[#6a6a6e] mt-0.5">{sub}</div>}
    </div>
  )
}
