'use client'

import { useState, useTransition } from 'react'
import { toggleNotificationRule } from '@/lib/actions/ops'
import type { NotificationRule } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  rules:     NotificationRule[]
  onRefresh: () => void
}

const CHANNEL_ICON: Record<string, string> = {
  email:     '📧',
  dashboard: '🔔',
  none:      '🔕',
}

const RECIPIENT_LABEL: Record<string, string> = {
  owner:         'Owner',
  assigned_user: 'Assigned User',
  all_admins:    'All Admins',
  custom_email:  'Custom',
}

export default function NotificationRulesTable({ rules, onRefresh }: Props) {
  const [pending, startTransition] = useTransition()

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleNotificationRule(id, !current)
      capture('ops_notification_rule_toggled', { enabled: !current })
      onRefresh()
    })
  }

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
        <span className="text-[22px]">🔔</span>
        <p className="text-[13px] font-medium text-white">No notification rules</p>
        <p className="text-[12px] text-[#6a6a6e]">Click "Seed Default Notification Rules" to set up standard alerting.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Notification Rules</p>
        <span className="text-[11px] text-[#6a6a6e]">{rules.filter((r) => r.is_enabled).length} active</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
            <button
              onClick={() => handleToggle(r.id, r.is_enabled)}
              disabled={pending}
              className={`w-9 h-5 rounded-full transition-colors shrink-0 relative disabled:opacity-40
                          ${r.is_enabled ? 'bg-[#22d093]' : 'bg-white/[0.12]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${r.is_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-medium ${r.is_enabled ? 'text-white' : 'text-[#6a6a6e]'}`}>{r.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10.5px] text-[#6a6a6e] capitalize">{r.trigger_type.replace(/_/g, ' ')}</span>
                {r.source   && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9a9a9d]">{r.source}</span>}
                {r.severity && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9a9a9d]">{r.severity}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[14px]">{CHANNEL_ICON[r.channel] ?? '🔔'}</span>
              <div className="text-right">
                <p className="text-[12px] text-[#9a9a9d] capitalize">{r.channel}</p>
                <p className="text-[10.5px] text-[#6a6a6e]">{RECIPIENT_LABEL[r.recipient_type]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
