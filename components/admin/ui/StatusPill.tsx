import type { AdminAuditStatus } from '@/lib/data/admin-audits'

const CONFIG: Record<AdminAuditStatus, { label: string; color: string }> = {
  new:       { label: 'New',        color: '#3b9eff' },
  in_review: { label: 'In Review',  color: '#ffae3c' },
  qualified: { label: 'Qualified',  color: '#22d093' },
  contacted: { label: 'Contacted',  color: '#a07cff' },
  converted: { label: 'Converted',  color: '#22d093' },
  archived:  { label: 'Archived',   color: '#6a6a6e' },
  unknown:   { label: 'Unknown',    color: '#6a6a6e' },
}

export default function StatusPill({ status }: { status: AdminAuditStatus }) {
  const c = CONFIG[status] ?? CONFIG.unknown
  return (
    <span
      className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
      style={{ color: c.color, borderColor: `${c.color}33`, background: `${c.color}12` }}
    >
      {c.label}
    </span>
  )
}
