'use client'

import type { ClientSystem } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import { useEffect } from 'react'

interface Props { systems: ClientSystem[] }

const STATUS_CONFIG = {
  active:       { dot: 'bg-[#22d093]', text: 'text-[#22d093]', label: 'Active' },
  inactive:     { dot: 'bg-[#ffae3c]', text: 'text-[#ffae3c]', label: 'Inactive' },
  unconfigured: { dot: 'bg-[#6a6a6e]', text: 'text-[#6a6a6e]', label: 'Not set' },
}

const TYPE_ICON: Record<string, string> = {
  widget: '🌐', whatsapp: '✆', calcom: '📅',
}

function formatDate(ts: string | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ClientSystemsPanel({ systems }: Props) {
  useEffect(() => {
    capture('client_system_opened', {})
  }, [])

  if (systems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
        <span className="text-[24px]">🌐</span>
        <p className="text-[13px] font-medium text-white">No client systems found</p>
        <p className="text-[12px] text-[#6a6a6e]">Configure your Widget, WhatsApp, or Cal.com to see client systems.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Client Systems</p>
        <span className="text-[11px] text-[#6a6a6e]">{systems.length} systems</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {systems.map((sys) => {
          const cfg = STATUS_CONFIG[sys.status] ?? STATUS_CONFIG.inactive
          return (
            <div key={`${sys.name}-${sys.type}`} className="flex items-center gap-4 px-5 py-3.5">
              <span className="text-[20px]">{TYPE_ICON[sys.type] ?? '⚙'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white">{sys.name}</p>
                <p className="text-[11px] text-[#6a6a6e] capitalize">{sys.type}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-[11.5px] font-medium ${cfg.text}`}>{cfg.label}</span>
                </div>
                <p className="text-[10.5px] text-[#6a6a6e] mt-0.5">{formatDate(sys.lastActivity)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
