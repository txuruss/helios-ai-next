import type { AuditTrailRow } from '@/lib/actions/ops'

interface Props {
  rows: AuditTrailRow[]
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

const ACTION_ICON: Record<string, string> = {
  status_changed:    '🔄',
  assigned:          '👤',
  unassigned:        '👤',
  'bulk.resolve':    '✓',
  'bulk.complete':   '✓',
  'bulk.acknowledge':'✓',
  'bulk.approve':    '✅',
  'bulk.reject':     '❌',
}

export default function OpsAuditTrail({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
        <span className="text-[22px]">📋</span>
        <p className="text-[13px] font-medium text-white">No audit trail yet</p>
        <p className="text-[12px] text-[#6a6a6e]">Actions on Ops items will appear here.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06]">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Audit Trail</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rows.map((row) => {
          const icon = ACTION_ICON[row.action.split('.')[0]] ?? '•'
          const action = row.action.replace(/_/g, ' ').replace(/\./g, ' › ')
          return (
            <div key={row.id} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-0.5 text-[14px] shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-white capitalize">{action}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10.5px] text-[#6a6a6e] font-mono">{row.target_table}</span>
                  {row.actor_label && <span className="text-[10.5px] text-[#6a6a6e]">by {row.actor_label}</span>}
                </div>
                {(row.before_state || row.after_state) && (
                  <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-[#6a6a6e]">
                    {row.before_state && <span>was: {JSON.stringify(row.before_state).slice(0, 40)}</span>}
                    {row.after_state  && <span>→ {JSON.stringify(row.after_state).slice(0, 40)}</span>}
                  </div>
                )}
              </div>
              <span className="text-[10.5px] text-[#6a6a6e] font-mono shrink-0">{relTime(row.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
