'use client'

// Shared presentational primitives for the Research Agent "Agents" tab.
// Pure UI — no network, no AI calls. Each agent module composes these.

import { useEffect, useRef, useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'

export type AgentStatus = 'coming_soon' | 'ready' | 'manual'

const STATUS_META: Record<AgentStatus, { label: string; color: string }> = {
  coming_soon: { label: 'Coming Soon', color: '#6a6a6e' },
  ready:       { label: 'Ready',       color: '#22d093' },
  manual:      { label: 'Manual',      color: '#ffae3c' },
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const m = STATUS_META[status]
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap shrink-0"
      style={{ color: m.color, borderColor: `${m.color}33`, background: `${m.color}12` }}>
      {m.label}
    </span>
  )
}

export function AgentCard({
  icon, name, purpose, status, children, footer,
}: {
  icon: React.ReactNode; name: string; purpose: string; status: AgentStatus
  children: React.ReactNode; footer?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden flex flex-col">
      <header className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-white/[0.04]">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-[#ff7a18]/[0.1] border border-[#ff7a18]/20 flex items-center justify-center text-[#ffae3c] shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-white leading-tight">{name}</h3>
            <p className="text-[12px] text-[#9a9a9d] mt-0.5">{purpose}</p>
          </div>
        </div>
        <AgentStatusBadge status={status} />
      </header>

      <div className="px-5 py-4 flex flex-col gap-3 flex-1">{children}</div>

      {footer && <footer className="px-5 py-3.5 border-t border-white/[0.04]">{footer}</footer>}
    </div>
  )
}

export function AgentField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6a6a6e] mb-1">{label}</div>
      <div className="text-[12.5px] text-[#cfd3dc] leading-relaxed">{children}</div>
    </div>
  )
}

// Clipboard copy with success / failure state. Never crashes.
export function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setState('ok')
    } catch {
      setState('err')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1800)
  }

  const tone =
    state === 'ok'  ? 'border-[#22d093]/40 text-[#22d093] bg-[#22d093]/[0.12]'
    : state === 'err' ? 'border-[#ff5247]/40 text-[#ff8a7a] bg-[#ff5247]/[0.12]'
    : 'border-white/[0.1] text-[#9a9a9d] bg-white/[0.04] hover:text-white hover:bg-white/[0.08]'

  return (
    <button type="button" onClick={copy} aria-label="Copy"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all shrink-0 ${tone}`}>
      {state === 'ok' ? <Check size={12} /> : state === 'err' ? <AlertTriangle size={12} /> : <Copy size={12} />}
      {state === 'ok' ? 'Copied' : state === 'err' ? 'Failed' : 'Copy'}
    </button>
  )
}

// Shared button classes for agent primary / secondary actions.
export const agentPrimaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium ' +
  'bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white ' +
  'transition-all disabled:opacity-50 disabled:cursor-not-allowed'

export const agentSecondaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium ' +
  'bg-white/[0.04] border border-white/[0.1] text-[#cfd3dc] hover:bg-white/[0.08] hover:text-white ' +
  'transition-all disabled:opacity-50 disabled:cursor-not-allowed'
