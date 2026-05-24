const CONFIG: Record<string, { label: string; color: string }> = {
  starter:  { label: 'Starter',    color: '#3b9eff' },
  pro:      { label: 'Booking OS', color: '#a07cff' },
  scale:    { label: 'Ops Center', color: '#ffae3c' },
  free:     { label: 'Free',       color: '#6a6a6e' },
}

export default function PlanPill({ plan }: { plan: string | null | undefined }) {
  const key = (plan ?? '').toLowerCase()
  const c   = CONFIG[key] ?? { label: plan ?? '—', color: '#6a6a6e' }
  return (
    <span
      className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
      style={{ color: c.color, borderColor: `${c.color}33`, background: `${c.color}10` }}
    >
      {c.label}
    </span>
  )
}
