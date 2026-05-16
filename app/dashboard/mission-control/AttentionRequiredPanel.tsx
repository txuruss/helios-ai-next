import type { OpsAlert, OpsTask } from '@/lib/actions/ops'
import Link from 'next/link'

interface Props {
  alerts: OpsAlert[]
  tasks:  OpsTask[]
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-[#ff8a7a] bg-[#ff8a7a]/10 border-[#ff8a7a]/20',
  error:    'text-[#ff8a7a] bg-[#ff8a7a]/10 border-[#ff8a7a]/20',
  warning:  'text-[#ffae3c] bg-[#ffae3c]/10 border-[#ffae3c]/20',
  info:     'text-[#9a9a9d] bg-white/[0.04] border-white/[0.08]',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-[#ff8a7a]',
  high:   'text-[#ffae3c]',
  normal: 'text-[#9a9a9d]',
  low:    'text-[#6a6a6e]',
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AttentionRequiredPanel({ alerts, tasks }: Props) {
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' || a.severity === 'error')
  const urgentTasks    = tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high')
  const items          = [...criticalAlerts.slice(0, 3), ...urgentTasks.slice(0, 3)]

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">
          Attention Required
        </div>
        <Link href="/dashboard/ops" className="text-[11.5px] text-[#ff7a18] hover:text-[#ffae3c] transition-colors">
          View all →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="text-[20px]">✅</span>
          <p className="text-[12.5px] text-white font-medium">All clear</p>
          <p className="text-[11.5px] text-[#6a6a6e]">No critical alerts or urgent tasks right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {criticalAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${SEVERITY_COLOR[alert.severity] ?? SEVERITY_COLOR.info}`}>
              <span className="mt-0.5 text-[13px]">{alert.severity === 'critical' ? '🔴' : '⚠'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-white truncate">{alert.title}</p>
                {alert.message && <p className="text-[11px] text-[#9a9a9d] mt-0.5 truncate">{alert.message}</p>}
              </div>
              <span className="text-[10.5px] text-[#6a6a6e] shrink-0">{relTime(alert.created_at)}</span>
            </div>
          ))}
          {urgentTasks.slice(0, 3).map((task) => (
            <div key={task.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
              <span className="mt-0.5 text-[13px]">📋</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-white truncate">{task.title}</p>
                <span className={`text-[10px] font-semibold uppercase ${PRIORITY_COLOR[task.priority]}`}>
                  {task.priority} · {task.status}
                </span>
              </div>
              <span className="text-[10.5px] text-[#6a6a6e] shrink-0">{relTime(task.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
