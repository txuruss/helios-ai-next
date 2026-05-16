'use client'

import type { OpsOverviewMetrics, OpsEvent, OpsAlert, OpsTask } from '@/lib/actions/ops'

interface Props {
  metrics: OpsOverviewMetrics
  events:  OpsEvent[]
  alerts:  OpsAlert[]
  tasks:   OpsTask[]
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-[#ff8a7a] bg-[#ff8a7a]/10',
  error:    'text-[#ff8a7a] bg-[#ff8a7a]/10',
  warning:  'text-[#ffae3c] bg-[#ffae3c]/10',
  info:     'text-[#9a9a9d] bg-white/[0.06]',
}

const STATUS_DOT: Record<string, string> = {
  open:         'bg-[#ffae3c]',
  acknowledged: 'bg-[#3b9eff]',
  resolved:     'bg-[#22d093]',
  active:       'bg-[#ff8a7a]',
  pending:      'bg-[#ffae3c]',
  in_progress:  'bg-[#3b9eff]',
  completed:    'bg-[#22d093]',
}

function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

function MetricCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-4 flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">{label}</span>
      <span className={`text-[28px] font-semibold ${color ?? 'text-white'}`}>{value}</span>
      {sub && <span className="text-[11.5px] text-[#6a6a6e]">{sub}</span>}
    </div>
  )
}

export default function OpsOverview({ metrics, events, alerts, tasks }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Open Events"    value={metrics.openEvents}       color={metrics.openEvents > 0 ? 'text-[#ffae3c]' : 'text-white'} />
        <MetricCard label="Active Tasks"   value={metrics.activeTasks}      />
        <MetricCard label="Active Alerts"  value={metrics.activeAlerts}     color={metrics.activeAlerts > 0 ? 'text-[#ff8a7a]' : 'text-white'} />
        <MetricCard label="Pending"        value={metrics.pendingApprovals} color={metrics.pendingApprovals > 0 ? 'text-[#ffae3c]' : 'text-white'} />
        <MetricCard label="Critical"       value={metrics.criticalCount}    color={metrics.criticalCount > 0 ? 'text-[#ff8a7a]' : 'text-white'} />
        <MetricCard label="Resolved Today" value={metrics.resolvedToday}    color="text-[#22d093]" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Events */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-4">Recent Events</p>
          {events.length === 0 ? (
            <p className="text-[12px] text-[#6a6a6e] py-4 text-center">No events yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[ev.status] ?? 'bg-[#9a9a9d]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-white truncate">{ev.title}</p>
                    <p className="text-[11px] text-[#6a6a6e] capitalize">{ev.source} · {ev.event_type}</p>
                  </div>
                  <span className="text-[10.5px] text-[#6a6a6e] shrink-0">{relTime(ev.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Open Items */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-4">Top Open Items</p>
          {alerts.length === 0 && tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="text-[20px]">✅</span>
              <p className="text-[12.5px] text-white font-medium">Nothing needs attention</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {alerts.filter((a) => a.status === 'active').slice(0, 3).map((alert) => (
                <div key={alert.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${SEVERITY_COLOR[alert.severity] ?? SEVERITY_COLOR.info}`}>
                  <span className="text-[12px]">⚠</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{alert.title}</p>
                    <p className="text-[10.5px] opacity-70 capitalize">{alert.alert_type}</p>
                  </div>
                </div>
              ))}
              {tasks.filter((t) => t.status === 'pending').slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                  <span className="text-[12px]">📋</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white truncate">{task.title}</p>
                    <p className="text-[10.5px] text-[#6a6a6e] capitalize">{task.priority} · {task.task_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
