'use client'

// Compact per-row action menu ("⋯") for admin tables. Collapses a row's
// secondary actions into a single dropdown so the Actions column stays
// narrow and always visible without horizontal scroll.
//
// Pure UI: each action just fires an onSelect callback supplied by the
// table. No server actions or data logic live here, so existing action
// handlers are reused unchanged.

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

export type ActionTone = 'default' | 'info' | 'success' | 'danger' | 'muted'

export interface RowAction {
  label:     string
  onSelect:  () => void
  tone?:     ActionTone
  disabled?: boolean
}

const TONE: Record<ActionTone, string> = {
  default: 'text-[#cfd3dc]',
  info:    'text-[#3b9eff]',
  success: 'text-[#22d093]',
  danger:  'text-[#ff8a7a]',
  muted:   'text-[#9a9a9d]',
}

export default function RowActionMenu({
  actions, label = 'Row actions', align = 'right', busy = false,
}: {
  actions: RowAction[]
  label?:  string
  align?:  'right' | 'left'
  busy?:   boolean
}) {
  const [open, setOpen] = useState(false)

  if (actions.length === 0) {
    return <span className="text-[#6a6a6e] text-[11px]">No actions</span>
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        disabled={busy}
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-white/[0.08]
                   bg-white/[0.03] text-[#9a9a9d] hover:text-white hover:bg-white/[0.07] transition-all
                   disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-50 mt-1 w-[180px]
                        rounded-xl border border-white/[0.10] bg-[#0f1012] shadow-2xl py-1`}
          >
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                onClick={() => { setOpen(false); a.onSelect() }}
                className={`w-full text-left px-3.5 py-2 text-[12.5px] ${TONE[a.tone ?? 'default']}
                            hover:bg-white/[0.05] hover:text-white transition-colors
                            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
