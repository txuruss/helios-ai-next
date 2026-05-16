'use client'

import { useState, useTransition } from 'react'
import { updateOpsAlertStatus } from '@/lib/actions/ops'
import type { OpsAlert } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props { alerts: OpsAlert[]; onRefresh: () => void }

const SEV_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'bg-[#ff8a7a]/10 border-[#ff8a7a]/20', text: 'text-[#ff8a7a]', icon: '🔴' },
  error:    { bg: 'bg-[#ff8a7a]/10 border-[#ff8a7a]/20', text: 'text-[#ff8a7a]', icon: '🔺' },
  warning:  { bg: 'bg-[#ffae3c]/10 border-[#ffae3c]/20', text: 'text-[#ffae3c]', icon: '⚠' },
  info:     { bg: 'bg-white/[0.03] border-white/[0.07]', text: 'text-[#9a9a9d]', icon: 'ℹ' },
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function OpsAlertPanel({ alerts, onRefresh }: Props) {
  const [filter, setFilter]  = useState('active')
  const [pending, startTransition] = useTransition()

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter)

  const handleAck = (id: string) => {
    startTransition(async () => {
      await updateOpsAlertStatus(id, 'acknowledged')
      capture('ops_alert_acknowledged', {})
      onRefresh()
    })
  }

  const handleResolve = (id: string) => {
    startTransition(async () => {
      await updateOpsAlertStatus(id, 'resolved')
      onRefresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        {['active', 'acknowledged', 'resolved', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize
                        ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f}
            {f === 'active' && alerts.filter((a) => a.status === 'active').length > 0 && (
              <span className="ml-1 text-[10px] px-1 rounded-full bg-[#ff8a7a]/20 text-[#ff8a7a]">
                {alerts.filter((a) => a.status === 'active').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">✅</span>
          <p className="text-[13px] font-medium text-white">No alerts</p>
          <p className="text-[12px] text-[#6a6a6e]">No {filter !== 'all' ? filter : ''} alerts right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((alert) => {
            const cfg = SEV_CONFIG[alert.severity] ?? SEV_CONFIG.info
            return (
              <div key={alert.id} className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border ${cfg.bg}`}>
                <span className="text-[16px] mt-0.5">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold ${cfg.text}`}>{alert.title}</p>
                  {alert.message && <p className="text-[12px] text-[#9a9a9d] mt-0.5">{alert.message}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e] mt-1 capitalize">{alert.alert_type} · {relTime(alert.created_at)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {alert.status === 'active' && (
                    <>
                      <button onClick={() => handleAck(alert.id)} disabled={pending}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[#3b9eff]/30 text-[#3b9eff] hover:bg-[#3b9eff]/10 transition-all disabled:opacity-40">
                        Acknowledge
                      </button>
                      <button onClick={() => handleResolve(alert.id)} disabled={pending}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
                        Resolve
                      </button>
                    </>
                  )}
                  {alert.status === 'acknowledged' && (
                    <button onClick={() => handleResolve(alert.id)} disabled={pending}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/10 transition-all disabled:opacity-40">
                      Resolve
                    </button>
                  )}
                  {alert.status === 'resolved' && (
                    <span className="text-[11px] text-[#22d093]">✓ Resolved</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
