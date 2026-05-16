'use client'

import { useState, useTransition } from 'react'
import { snoozeOpsItem, unsnoozeOpsItem } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  table:        'ops_events' | 'ops_alerts' | 'ops_tasks' | 'approval_items'
  id:           string
  isSnoozed:    boolean
  snoozedUntil: string | null
  onUpdated:    () => void
}

const PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '1 hour',  minutes: 60    },
  { label: '4 hours', minutes: 240   },
  { label: '24 hours',minutes: 1440  },
  { label: '7 days',  minutes: 10080 },
]

function relTime(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d`
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

export default function SnoozeControl({ table, id, isSnoozed, snoozedUntil, onUpdated }: Props) {
  const [open,    setOpen]    = useState(false)
  const [pending, startTransition] = useTransition()

  const handleSnooze = (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60_000).toISOString()
    setOpen(false)
    startTransition(async () => {
      await snoozeOpsItem({ table, target_id: id, snoozed_until: until })
      capture('ops_item_snoozed', { table, minutes })
      onUpdated()
    })
  }

  const handleUnsnooze = () => {
    startTransition(async () => {
      await unsnoozeOpsItem(table, id)
      capture('ops_item_unsnoozed', { table })
      onUpdated()
    })
  }

  if (isSnoozed && snoozedUntil) {
    return (
      <button onClick={handleUnsnooze} disabled={pending}
        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#ffae3c]/10 text-[#ffae3c] hover:bg-[#ffae3c]/20 transition-all disabled:opacity-40 whitespace-nowrap"
        title={`Snoozed until ${new Date(snoozedUntil).toLocaleString()}`}>
        💤 {relTime(snoozedUntil)} · Unsnooze
      </button>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={pending}
        className="text-[10.5px] px-2 py-0.5 rounded-lg border border-white/[0.08] text-[#6a6a6e] hover:text-[#9a9a9d] hover:bg-white/[0.04] transition-all disabled:opacity-40">
        💤
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-32 rounded-xl border border-white/[0.10] bg-[#0c0d0f] shadow-2xl z-20 overflow-hidden">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => handleSnooze(p.minutes)}
                className="w-full text-left px-3 py-2 text-[12px] text-[#9a9a9d] hover:bg-white/[0.06] hover:text-white transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
