'use client'

import { useState, useTransition } from 'react'
import { snoozeOpsItem, unsnoozeOpsItem } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import SnoozePicker from './SnoozePicker'

interface Props {
  table:        'ops_events' | 'ops_alerts' | 'ops_tasks' | 'approval_items'
  id:           string
  isSnoozed:    boolean
  snoozedUntil: string | null
  onUpdated:    () => void
}

function relTime(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now()
  if (diff <= 0) return 'expired'
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

  const handleSnooze = (snoozedUntilTs: string, reason?: string) => {
    setOpen(false)
    startTransition(async () => {
      await snoozeOpsItem({ table, target_id: id, snoozed_until: snoozedUntilTs, snooze_reason: reason })
      capture('ops_item_snoozed', { table })
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
          <div className="absolute right-0 mt-1 z-20">
            <SnoozePicker
              onSnooze={(until, reason) => {
                capture('ops_snooze_custom_selected', { table, has_reason: !!reason })
                handleSnooze(until, reason)
              }}
              onClose={() => setOpen(false)}
              disabled={pending}
            />
          </div>
        </>
      )}
    </div>
  )
}
