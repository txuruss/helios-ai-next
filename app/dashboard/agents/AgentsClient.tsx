'use client'

import { useActionState, useState } from 'react'
import { upsertAgentSettings } from '@/lib/actions/agents'
import { AGENT_DEFINITIONS } from '@/lib/constants'
import { cn } from '@/components/ui/cn'
import type { AgentSettings } from '@/types'

const MOCK_RUNTIME: Record<string, { status: string; lastRun: string; runs: number; errRate: string; queue: number }> = {
  'orchestrator': { status: 'healthy',  lastRun: '2 min ago',  runs: 3401, errRate: '0.0%',  queue: 0 },
  'research':     { status: 'healthy',  lastRun: '14 min ago', runs: 892,  errRate: '0.2%',  queue: 2 },
  'website-audit':{ status: 'healthy',  lastRun: '1 hr ago',   runs: 612,  errRate: '0.0%',  queue: 0 },
  'qualifier':    { status: 'healthy',  lastRun: '5 min ago',  runs: 1284, errRate: '0.02%', queue: 5 },
  'sales':        { status: 'degraded', lastRun: '3 hr ago',   runs: 148,  errRate: '1.4%',  queue: 1 },
  'content':      { status: 'healthy',  lastRun: '30 min ago', runs: 744,  errRate: '0.1%',  queue: 3 },
  'qa':           { status: 'idle',     lastRun: '1 day ago',  runs: 88,   errRate: '0.0%',  queue: 0 },
  'admin':        { status: 'healthy',  lastRun: '1 hr ago',   runs: 2100, errRate: '0.0%',  queue: 0 },
}

const STATUS_COLOR: Record<string, string> = {
  healthy: 'pill-green', degraded: 'pill-amber', idle: 'pill-mute', running: 'pill-cyan',
}

type Filter = 'all' | 'healthy' | 'degraded' | 'idle'

const fieldCls =
  'h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] ' +
  'text-white placeholder:text-[#6a6a6e] outline-none transition-all ' +
  'focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50'
const labelCls = 'text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block'

function AgentSettingsPanel({ initialSettings }: { initialSettings: AgentSettings | null }) {
  const [state, formAction, pending] = useActionState(upsertAgentSettings, {})
  return (
    <form action={formAction} className="border border-white/10 rounded-2xl p-6 mb-8">
      <h3 className="text-[16px] font-semibold mb-1">AI Configuration</h3>
      <p className="text-[13px] text-[#9a9a9d] mb-5">Customize how your AI assistant introduces itself and captures leads.</p>

      {state.error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13px] text-[#ff8a7a]">{state.error}</div>
      )}
      {state.success && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#22d093]/10 border border-[#22d093]/30 text-[13px] text-[#22d093]">{state.success}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        <div className="sm:col-span-2">
          <label className={labelCls}>Bot Name *</label>
          <input name="agent_name" type="text" required
            defaultValue={initialSettings?.agent_name ?? 'Helios AI Assistant'}
            placeholder="Helios AI Assistant" className={fieldCls} disabled={pending} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Persona Prompt</label>
          <textarea name="persona_prompt" rows={4}
            defaultValue={initialSettings?.persona_prompt ?? ''}
            placeholder="You are a friendly AI assistant for [Business Name]. You help customers book appointments, answer questions, and capture contact info…"
            disabled={pending}
            className="w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 py-3 text-[14px] text-white placeholder:text-[#6a6a6e] outline-none resize-none transition-all focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50" />
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-5 mb-5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-3">Lead Capture Fields</div>
        <div className="flex flex-wrap gap-5">
          {[
            { name: 'collect_name',  label: 'Collect Name',  def: initialSettings?.collect_name  ?? true  },
            { name: 'collect_email', label: 'Collect Email', def: initialSettings?.collect_email ?? true  },
            { name: 'collect_phone', label: 'Collect Phone', def: initialSettings?.collect_phone ?? false },
          ].map(({ name, label, def }) => (
            <label key={name} className="flex items-center gap-2 text-[13.5px] cursor-pointer">
              <input type="checkbox" name={name} defaultChecked={def}
                className="w-4 h-4 rounded accent-[#ff7a18]" disabled={pending} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending
            ? <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" /> Saving…</>
            : 'Save Configuration'}
        </button>
      </div>
    </form>
  )
}

export default function AgentsClient({ initialSettings }: { initialSettings: AgentSettings | null }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState('')

  const filtered = AGENT_DEFINITIONS.filter((a) => {
    const rt = MOCK_RUNTIME[a.id]
    return filter === 'all' || rt?.status === filter
  })

  const counts = {
    all:      AGENT_DEFINITIONS.length,
    healthy:  Object.values(MOCK_RUNTIME).filter((r) => r.status === 'healthy').length,
    degraded: Object.values(MOCK_RUNTIME).filter((r) => r.status === 'degraded').length,
    idle:     Object.values(MOCK_RUNTIME).filter((r) => r.status === 'idle').length,
  }

  return (
    <>
      <AgentSettingsPanel initialSettings={initialSettings} />

      {toast && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#5be3c5]/10 border border-[#5be3c5]/30 text-[13px] text-[#5be3c5]">
          {toast}
        </div>
      )}

      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-4">Agent Status</div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'healthy', 'degraded', 'idle'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              'h-8 px-4 rounded-full text-[12.5px] border transition-all',
              filter === f
                ? 'bg-[#ff7a18]/12 border-[#ff7a18]/35 text-[#ffae3c]'
                : 'bg-white/[0.02] border-white/10 text-[#9a9a9d] hover:text-white hover:bg-white/[0.04]',
            )}>
            {f.charAt(0).toUpperCase() + f.slice(1)}{' '}
            <span className="ml-1 text-[10.5px] bg-white/[0.08] px-1.5 py-0.5 rounded-full">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((agent) => {
          const rt = MOCK_RUNTIME[agent.id]
          return (
            <div key={agent.id}
              className={cn(
                'border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200',
                rt?.status === 'degraded'
                  ? 'border-[#ffb547]/30 bg-[#ffb547]/[0.03]'
                  : 'border-white/10 bg-[#0f1012]/60 hover:border-white/[0.14]',
              )}>
              <div className="flex items-start gap-3">
                <div className="w-[38px] h-[38px] rounded-[10px] shrink-0 flex items-center justify-center bg-[#ff7a18]/[0.18] border border-[#ff7a18]/20 text-[#ffae3c] text-lg">⚙</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-white">{agent.name}</div>
                  <span className={cn('pill text-[10.5px] mt-1.5', STATUS_COLOR[rt?.status ?? 'idle'] ?? 'pill-mute')}>
                    {rt?.status ?? 'unknown'}
                  </span>
                </div>
              </div>
              <p className="text-[13px] text-[#9a9a9d] leading-relaxed">{agent.description}</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Runs',     v: rt?.runs.toLocaleString() ?? '—' },
                  { l: 'Errors',   v: rt?.errRate ?? '—', warn: parseFloat(rt?.errRate ?? '0') > 0 },
                  { l: 'Queue',    v: String(rt?.queue ?? 0), cyan: (rt?.queue ?? 0) > 0 },
                  { l: 'Last run', v: rt?.lastRun ?? '—' },
                ].map(({ l, v, warn, cyan }) => (
                  <div key={l} className="p-2.5 rounded-[9px] bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6a6a6e]">{l}</span>
                    <span className={cn('text-[13px] font-medium font-mono', warn ? 'text-[#ffb547]' : cyan ? 'text-[#5be3c5]' : 'text-white')}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                <button
                  onClick={() => { setToast(`Mock: Would trigger "${agent.name}". Connect Anthropic API in Phase 3.`); setTimeout(() => setToast(''), 4000) }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] bg-[#ff7a18]/12 border border-[#ff7a18]/30 text-[#ffae3c] hover:bg-[#ff7a18]/20 hover:border-[#ff7a18]/50 transition-all">
                  ▶ Run
                </button>
                <button className="h-8 px-3 rounded-lg text-[12.5px] border border-white/10 bg-white/[0.025] text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">View Logs</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 p-5 rounded-2xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-2">Phase 3 — Anthropic Integration</div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Clicking <strong className="text-white">Run</strong> will call{' '}
          <code className="font-mono text-[#5be3c5]">POST /api/agents/:id/run</code> which triggers the corresponding Anthropic Claude agent.
        </p>
      </div>
    </>
  )
}
