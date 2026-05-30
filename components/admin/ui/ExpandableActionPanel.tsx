'use client'

// Smooth, full-width action panel that unfolds directly beneath a table
// row. Built for the admin tables (audits / clients / launch readiness) so
// the row "unfolds" into its actions instead of opening a cramped menu.
//
// Animation uses pure CSS (no new dependency):
//   • grid-template-rows 0fr → 1fr  (height reveal)
//   • opacity + translate-y          (content fade/slide)
//   • overflow-hidden                (clip while collapsed)
//
// Layout: place this inside a full-width <td colSpan={n} className="p-0">.
// While collapsed the panel has zero height and is pointer-inert.

import type { ReactNode } from 'react'

export type PanelActionVariant = 'primary' | 'success' | 'info' | 'danger' | 'secondary'

const VARIANT: Record<PanelActionVariant, string> = {
  primary:   'bg-[#ff7a18]/[0.16] border-[#ff7a18]/45 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white',
  success:   'bg-[#22d093]/[0.10] border-[#22d093]/30 text-[#22d093] hover:bg-[#22d093]/20 hover:text-white',
  info:      'bg-[#3b9eff]/[0.10] border-[#3b9eff]/30 text-[#7ec0ff] hover:bg-[#3b9eff]/20 hover:text-white',
  danger:    'bg-[#ff4d3a]/[0.10] border-[#ff4d3a]/30 text-[#ff8a7a] hover:bg-[#ff4d3a]/20 hover:text-white',
  secondary: 'bg-white/[0.03] border-white/[0.10] text-[#cfd3dc] hover:bg-white/[0.07] hover:text-white',
}

export function PanelActionButton({
  children, onClick, variant = 'secondary', disabled = false, title,
}: {
  children:  ReactNode
  onClick:   () => void
  variant?:  PanelActionVariant
  disabled?: boolean
  title?:    string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border
                  transition-all disabled:opacity-40 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/30 ${VARIANT[variant]}`}
    >
      {children}
    </button>
  )
}

// Optional grouping label inside the panel (e.g. "Available actions").
export function PanelSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6a6a6e]">
      {children}
    </span>
  )
}

export default function ExpandableActionPanel({
  open, title, description, meta, actions, secondary, children,
}: {
  open:         boolean
  title?:       ReactNode   // primary section eyebrow, e.g. "Recommended next action"
  description?: ReactNode   // the recommended action text
  meta?:        ReactNode   // primary section status pills / scores
  actions?:     ReactNode   // primary actions (strong)
  secondary?:   ReactNode   // secondary actions (subtle)
  children?:    ReactNode   // detail content (e.g. CompactDataList)
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none
                  ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
    >
      <div className={`overflow-hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div
          className={`mx-2 mb-3 mt-1 rounded-xl border border-[#ff7a18]/25 bg-[#0f1012]/80
                      transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none
                      ${open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
        >
          {(title || description || meta) && (
            <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.06] flex flex-col gap-2.5">
              {(title || description) && (
                <div className="flex flex-col gap-0.5">
                  {title && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#ff7a18]">
                      {title}
                    </span>
                  )}
                  {description && <span className="text-[13px] text-white leading-snug">{description}</span>}
                </div>
              )}
              {meta && <div className="flex items-center gap-2 flex-wrap">{meta}</div>}
            </div>
          )}

          {actions && (
            <div className="px-4 py-3 flex items-center gap-2 flex-wrap">{actions}</div>
          )}

          {secondary && (
            <div className="px-4 pb-3 -mt-1 flex items-center gap-2 flex-wrap">{secondary}</div>
          )}

          {children && (
            <div className="px-4 py-3 border-t border-white/[0.06]">{children}</div>
          )}
        </div>
      </div>
    </div>
  )
}
