'use client'

import { useState } from 'react'
import PageHeader from '@/components/dashboard/PageHeader'
import { AGENT_DEFINITIONS } from '@/lib/constants'
import { cn } from '@/components/ui/cn'

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
  healthy:  'pill-green',
  degraded: 'pill-amber',
  idle:     'pill-mute',
  running:  'pill-cyan',
}

type Filter = 'all' | 'healthy' | 'degraded' | 'idle'

export default function AgentsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState('')

  const filtered = AGENT_DEFINITIONS.filter((a) => {
    const rt = MOCK_RUNTIME[a.id]
    return filter === 'all' || rt?.status === filter
  })

  const counts = {
    all: AGENT_DEFINITIONS.length,
    healthy:  Object.values(MOCK_RUNTIME).filter((r) => r.status === 'healthy').length,
    degraded: Object.values(MOCK_RUNTIME).filter((r) => r.status === 'degraded').length,
    idle:     Object.values(MOCK_RUNTIME).filter((r) => r.status === 'idle').length,
  }

  const handleRun = (name: string) => {
    setToast(`Mock: Would trigger "${name}". Connect Anthropic API in Phase 2.`)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <PageHeader
        eyebrow="AI Agents"
        title="Agent Hub"
        description="Monitor, run, and manage all Helios AI agents. Phase 2: connect Anthropic to enable real agent runs."
      />

      {toast && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#5be3c5]/10 border border-[#5be3c5]/30
                        text-[13px] text-[#5be3c5]">
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'healthy', 'degraded', 'idle'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-8 px-4 rounded-full text-[12.5px] border transition-all',
              filter === f
                ? 'bg-[#ff7a18]/12 border-[#ff7a18]/35 text-[#ffae3c]'
                : 'bg-white/[0.02] border-white/10 text-[#9a9a9d] hover:text-white hover:bg-white/[0.04]',
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}{' '}
            <span className="ml-1 text-[10.5px] bg-white/[0.08] px-1.5 py-0.5 rounded-full">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((agent) => {
          const rt = MOCK_RUNTIME[agent.id]
          return (
            <div
              key={agent.id}
              className={cn(
                'border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200',
                rt?.status === 'degraded'
                  ? 'border-[#ffb547]/30 bg-[#ffb547]/[0.03]'
                  : 'border-white/10 bg-[#0f1012]/60 hover:border-white/[0.14]',
              )}
            >
              {/* Head */}
              <div className="flex items-start gap-3">
                <div className="w-[38px] h-[38px] rounded-[10px] shrink-0 flex items-center justify-center
                                bg-[#ff7a18]/[0.18] border border-[#ff7a18]/20 text-[#ffae3c] text-lg">
                  ⚙
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-white">{agent.name}</div>
                  <span className={cn('pill text-[10.5px] mt-1.5', STATUS_COLOR[rt?.status ?? 'idle'] ?? 'pill-mute')}>
                    {rt?.status ?? 'unknown'}
                  </span>
                </div>
              </div>

              <p className="text-[13px] text-[#9a9a9d] leading-relaxed">{agent.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Runs',     v: rt?.runs.toLocaleString() ?? '—' },
                  { l: 'Errors',   v: rt?.errRate ?? '—', warn: parseFloat(rt?.errRate ?? '0') > 0 },
                  { l: 'Queue',    v: String(rt?.queue ?? 0), cyan: (rt?.queue ?? 0) > 0 },
                  { l: 'Last run', v: rt?.lastRun ?? '—' },
                ].map(({ l, v, warn, cyan }) => (
                  <div key={l} className="p-2.5 rounded-[9px] bg-white/[0.02] border border-white/[0.06] flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6a6a6e]">{l}</span>
                    <span className={cn(
                      'text-[13px] font-medium font-mono',
                      warn ? 'text-[#ffb547]' : cyan ? 'text-[#5be3c5]' : 'text-white',
                    )}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-white/[0.06]">
                <button
                  onClick={() => handleRun(agent.name)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px]
                             bg-[#ff7a18]/12 border border-[#ff7a18]/30 text-[#ffae3c]
                             hover:bg-[#ff7a18]/20 hover:border-[#ff7a18]/50 transition-all"
                >
                  ▶ Run
                </button>
                <button className="h-8 px-3 rounded-lg text-[12.5px] border border-white/10
                                    bg-white/[0.025] text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">
                  View Logs
                </button>
                <button className="h-8 px-3 rounded-lg text-[12.5px] border border-white/10
                                    bg-white/[0.025] text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">
                  Settings
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Phase 2 callout */}
      <div className="mt-8 p-5 rounded-2xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-2">
          Phase 2 — Anthropic Integration
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Clicking <strong className="text-white">Run</strong> will call{' '}
          <code className="font-mono text-[#5be3c5]">POST /api/agents/:id/run</code> which triggers the
          corresponding Anthropic Claude agent. Agent definitions, tool configs, and prompts live in{' '}
          <code className="font-mono text-[#5be3c5]">lib/agents/</code>.
        </p>
      </div>
    </>
  )
}
