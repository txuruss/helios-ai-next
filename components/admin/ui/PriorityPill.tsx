import type { AdminAuditPriority } from '@/lib/data/admin-audits'

const CONFIG: Record<AdminAuditPriority, { label: string; color: string }> = {
  urgent:  { label: 'Urgent',  color: '#ff8a7a' },
  high:    { label: 'High',    color: '#ffae3c' },
  normal:  { label: 'Normal',  color: '#9a9a9d' },
  low:     { label: 'Low',     color: '#3b9eff' },
  unknown: { label: '—',       color: '#6a6a6e' },
}

export default function PriorityPill({ priority }: { priority: AdminAuditPriority }) {
  const c = CONFIG[priority] ?? CONFIG.unknown
  return (
    <span
      className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
      style={{ color: c.color, borderColor: `${c.color}33`, background: `${c.color}10` }}
    >
      {c.label}
    </span>
  )
}
