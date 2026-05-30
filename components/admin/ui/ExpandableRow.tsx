'use client'

// Shared expand/collapse primitives for compact admin tables.
//   • ExpandToggle      — a chevron button that rotates when open.
//   • ExpandedDetailRow — a full-width <tr> that holds secondary details
//     moved out of the main (compact) row. Renders nothing when closed.
//
// Used by /admin/audits, /admin/delivery, /admin/launch-readiness and
// (optionally) /admin/clients to keep rows narrow and avoid horizontal
// scroll while preserving every field in an expandable panel.

import type { ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

// Labelled "Actions" toggle for the Actions column. Clicking it opens the
// same expandable action panel the row chevron controls, so either entry
// point unfolds the row. Highlights in the orange accent while open.
export function ActionsToggle({
  open, onToggle, label = 'Actions',
}: {
  open: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border
                  transition-all focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30
                  ${open
                    ? 'bg-[#ff7a18]/[0.16] border-[#ff7a18]/45 text-[#ffae3c]'
                    : 'bg-white/[0.03] border-white/[0.08] text-[#9a9a9d] hover:text-white hover:bg-white/[0.07]'}`}
    >
      {label}
      <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

export function ExpandToggle({
  open, onToggle, label = 'Toggle row details',
}: {
  open: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={open}
      className="flex items-center justify-center w-5 h-5 rounded-md text-[#6a6a6e]
                 hover:text-white hover:bg-white/[0.06] transition-all
                 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30"
    >
      <ChevronRight size={13} className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
    </button>
  )
}

export function ExpandedDetailRow({
  open, colSpan, children, tinted = false,
}: {
  open: boolean
  colSpan: number
  children: ReactNode
  tinted?: boolean
}) {
  if (!open) return null
  return (
    <tr className="border-t border-white/[0.04]">
      <td
        colSpan={colSpan}
        className={`px-4 py-4 ${tinted ? 'bg-[#ff7a18]/[0.025]' : 'bg-white/[0.015]'}`}
      >
        {children}
      </td>
    </tr>
  )
}
