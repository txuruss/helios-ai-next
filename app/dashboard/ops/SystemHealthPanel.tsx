'use client'

import type { SystemHealthItem } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import { useEffect } from 'react'
import ProductionLaunchChecklist   from './ProductionLaunchChecklist'
import WebhookObservabilityPanel  from './WebhookObservabilityPanel'

interface Props { items: SystemHealthItem[] }

const STATUS_CONFIG = {
  healthy:      { dot: 'bg-[#22d093]', ring: 'border-[#22d093]/20 bg-[#22d093]/[0.04]', text: 'text-[#22d093]', label: 'Healthy' },
  degraded:     { dot: 'bg-[#ffae3c]', ring: 'border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]', text: 'text-[#ffae3c]', label: 'Degraded' },
  unconfigured: { dot: 'bg-[#6a6a6e]', ring: 'border-white/[0.07] bg-white/[0.02]',     text: 'text-[#6a6a6e]', label: 'Not set' },
  unknown:      { dot: 'bg-[#4a4a4e]', ring: 'border-white/[0.05] bg-white/[0.01]',     text: 'text-[#4a4a4e]', label: 'Unknown' },
}

const SYSTEM_ICON: Record<string, string> = {
  'Chat Widget': '🌐', 'Anthropic AI': '🤖', 'Cal.com': '📅',
  'WhatsApp': '✆', 'Stripe': '💳', 'Relevance AI': '⚡', 'PostHog': '📊', 'Sentry': '🛡',
}

export default function SystemHealthPanel({ items }: Props) {
  useEffect(() => {
    capture('system_health_viewed', {})
  }, [])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
        <span className="text-[24px]">⚙</span>
        <p className="text-[13px] font-medium text-white">No systems found</p>
        <p className="text-[12px] text-[#6a6a6e]">Configure your integrations to see health status.</p>
      </div>
    )
  }

  const healthy      = items.filter((i) => i.status === 'healthy').length
  const degraded     = items.filter((i) => i.status === 'degraded').length
  const unconfigured = items.filter((i) => i.status === 'unconfigured').length

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex gap-4 px-4 py-3 rounded-xl border border-white/[0.07] bg-[#0f1012]">
        <span className="text-[12px] text-[#22d093] font-medium">{healthy} healthy</span>
        {degraded > 0 && <span className="text-[12px] text-[#ffae3c] font-medium">{degraded} degraded</span>}
        {unconfigured > 0 && <span className="text-[12px] text-[#6a6a6e]">{unconfigured} not configured</span>}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status]
          return (
            <div key={item.name} className={`flex flex-col gap-3 rounded-2xl border p-4 ${cfg.ring}`}>
              <div className="flex items-center justify-between">
                <span className="text-[20px]">{SYSTEM_ICON[item.name] ?? '⚙'}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-[10px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                </div>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">{item.name}</p>
                <p className="text-[11.5px] text-[#6a6a6e] mt-0.5 truncate">{item.detail}</p>
              </div>
            </div>
          )
        })}
      </div>

      <ProductionLaunchChecklist initialChecks={[]} />
      <WebhookObservabilityPanel />
    </div>
  )
}
