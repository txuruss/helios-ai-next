'use client'

import { useActionState, useState } from 'react'
import { upsertAgentSettings } from '@/lib/actions/agents'
import { cn } from '@/components/ui/cn'
import AgentRunButton from './AgentRunButton'
import WorkforceRunButton from './WorkforceRunButton'
import AgentRunHistory from './AgentRunHistory'
import AgentOutputDrawer from './AgentOutputDrawer'
import AgentRecommendationCard from './AgentRecommendationCard'
import type { HeliosAgent, RelevanceWorkforce, AgentRun, AgentRecommendation, AgentSettings, AgentOutput } from '@/types'

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }
const CATEGORY_ICONS: Record<string, string> = {
  core: '⚙', research: '🔍', sales: '💼', content: '✍',
  delivery: '🚀', comms: '💬', analytics: '📊',
}

interface Props {
  agents:               HeliosAgent[]
  workforces:           RelevanceWorkforce[]
  recentRuns:           AgentRun[]
  recommendations:      AgentRecommendation[]
  initialSettings:      AgentSettings | null
  relevanceConfigured:  boolean
  currentPlan:          string
  businessId:           string | null
  totalAgentsInDb:      number
}

type Tab = 'agents' | 'workforces' | 'history' | 'recommendations'

const fieldCls =
  'h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] ' +
  'text-white placeholder:text-[#6a6a6e] outline-none transition-all ' +
  'focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50'
const labelCls = 'text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block'

export default function AgentsClient({
  agents, workforces, recentRuns, recommendations,
  initialSettings, relevanceConfigured, currentPlan, totalAgentsInDb,
}: Props) {
  const [tab, setTab]                   = useState<Tab>('agents')
  const [selectedRun, setSelectedRun]   = useState<AgentRun | null>(null)
  const [runOutputs,  setRunOutputs]    = useState<AgentOutput[]>([])

  const [settingsState, settingsAction, settingsPending] = useActionState(upsertAgentSettings, {})

  const canRun = (requiredPlan: string) =>
    (PLAN_ORDER[currentPlan] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0)

  const pendingRecs    = recommendations.filter((r) => r.status === 'pending').length
  const runningRuns    = recentRuns.filter((r) => r.status === 'running').length

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'agents',          label: 'Agents' },
    { id: 'workforces',      label: 'Workforces' },
    { id: 'history',         label: 'Run History',    badge: runningRuns  || undefined },
    { id: 'recommendations', label: 'Recommendations', badge: pendingRecs || undefined },
  ]

  const handleSelectRun = async (run: AgentRun) => {
    setSelectedRun(run)
    try {
      const res  = await fetch(`/api/relevance/runs/${run.id}`)
      const data = await res.json()
      setRunOutputs(data.outputs ?? [])
    } catch { setRunOutputs([]) }
  }

  return (
    <>
      {selectedRun && (
        <AgentOutputDrawer
          run={selectedRun}
          outputs={runOutputs}
          onClose={() => { setSelectedRun(null); setRunOutputs([]) }}
        />
      )}

      {/* Relevance status banner */}
      {!relevanceConfigured && (
        <div className="mb-5 flex items-start gap-3 px-5 py-4 rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] text-[13.5px] text-[#ffae3c]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <strong>Relevance AI not configured</strong> — agents run in demo mode.
            Add <code className="font-mono text-[12px]">RELEVANCE_API_KEY</code>, <code className="font-mono text-[12px]">RELEVANCE_PROJECT_ID</code>,
            and <code className="font-mono text-[12px]">RELEVANCE_REGION</code> to <code className="font-mono text-[12px]">.env.local</code> to enable real runs.
          </span>
        </div>
      )}

      {/* AI widget config */}
      <form action={settingsAction} className="border border-white/10 rounded-2xl p-5 mb-6">
        <h3 className="text-[14px] font-semibold mb-4">Widget AI Configuration</h3>
        {settingsState.error   && <p className="text-[12px] text-[#ff8a7a] mb-3">{settingsState.error}</p>}
        {settingsState.success && <p className="text-[12px] text-[#22d093] mb-3">{settingsState.success}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Bot Name *</label>
            <input name="agent_name" type="text" required defaultValue={initialSettings?.agent_name ?? 'Helios AI Assistant'}
              className={fieldCls} disabled={settingsPending} />
          </div>
          <div>
            <label className={labelCls}>Persona Prompt</label>
            <input name="persona_prompt" type="text" defaultValue={initialSettings?.persona_prompt ?? ''}
              placeholder="You are a helpful AI assistant…" className={fieldCls} disabled={settingsPending} />
          </div>
        </div>
        <div className="flex flex-wrap gap-5 mb-4">
          {([['collect_name','Collect Name',initialSettings?.collect_name??true],['collect_email','Collect Email',initialSettings?.collect_email??true],['collect_phone','Collect Phone',initialSettings?.collect_phone??false]] as const).map(([name, label, def]) => (
            <label key={name} className="flex items-center gap-2 text-[13.5px] cursor-pointer">
              <input type="checkbox" name={name} defaultChecked={def}
                className="w-4 h-4 rounded accent-[#ff7a18]" disabled={settingsPending} />
              {label}
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={settingsPending} className="btn-primary btn-sm disabled:opacity-60">
            {settingsPending ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </form>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-4 rounded-[9px] text-[13px] transition-all',
              tab === t.id ? 'bg-[#ff7a18]/12 text-[#ffae3c] border border-[#ff7a18]/20' : 'text-[#9a9a9d] hover:text-white',
            )}>
            {t.label}
            {t.badge ? (
              <span className="w-4 h-4 rounded-full bg-[#ff7a18]/30 text-[#ffae3c] text-[10px] flex items-center justify-center font-bold">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Agents ── */}
      {tab === 'agents' && (
        agents.length === 0 ? (
          <div className="border border-white/10 rounded-2xl p-12 text-center">
            {totalAgentsInDb === 0 ? (
              <>
                <div className="text-3xl mb-3">⚙</div>
                <h3 className="text-[17px] font-semibold mb-2">Migration required</h3>
                <p className="text-[13.5px] text-[#9a9a9d] mb-3">No agent definitions found in the database.</p>
                <p className="text-[12.5px] text-[#6a6a6e]">
                  Apply <code className="font-mono text-[#5be3c5]">db/add-relevance-ai-fields.sql</code> via
                  Supabase Dashboard → SQL Editor to seed the 18 Helios AI agents.
                </p>
              </>
            ) : (
              <>
                <div className="text-3xl mb-3">🔍</div>
                <h3 className="text-[17px] font-semibold mb-2">No enabled agents visible</h3>
                <p className="text-[13.5px] text-[#9a9a9d] mb-3">
                  {totalAgentsInDb} agent{totalAgentsInDb !== 1 ? 's' : ''} exist in the database but none match the current filter.
                </p>
                <p className="text-[12.5px] text-[#6a6a6e]">
                  Check that agents have <code className="font-mono text-[#5be3c5]">is_enabled = true</code> and{' '}
                  <code className="font-mono text-[#5be3c5]">business_id IS NULL</code> (global) or match your business.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div key={agent.id}
                className="border border-white/10 bg-[#0f1012]/60 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/[0.14] transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center text-base bg-[#ff7a18]/[0.18] border border-[#ff7a18]/20 text-[#ffae3c]">
                    {CATEGORY_ICONS[agent.category ?? ''] ?? '⚙'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[14px] font-semibold text-white">{agent.name}</span>
                      {agent.required_plan !== 'starter' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#ffae3c]/12 border border-[#ffae3c]/20 text-[#ffae3c] font-medium uppercase tracking-[0.08em]">
                          {agent.required_plan}+
                        </span>
                      )}
                    </div>
                    <span className={cn('pill text-[10px]', {
                      'pill-green': agent.status === 'idle' || agent.status === 'completed',
                      'pill-cyan':  agent.status === 'running',
                      'pill-amber': agent.status === 'degraded',
                      'pill-red':   agent.status === 'error',
                    })}>{agent.status}</span>
                  </div>
                </div>
                {agent.description && (
                  <p className="text-[13px] text-[#9a9a9d] leading-relaxed">{agent.description}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] text-[#6a6a6e] capitalize">{agent.category ?? 'general'}</span>
                  <AgentRunButton
                    agent={agent}
                    relevanceReady={relevanceConfigured}
                    canRun={canRun(agent.required_plan)}
                    planRequired={agent.required_plan}
                    currentPlan={currentPlan}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Workforces ── */}
      {tab === 'workforces' && (
        <div className="flex flex-col gap-4">
          {workforces.length === 0 ? (
            <div className="border border-white/10 rounded-2xl p-12 text-center">
              <p className="text-[14px] text-[#6a6a6e]">No workforces found. Run the DB migration to seed workforce definitions.</p>
            </div>
          ) : (
            workforces.map((wf) => (
              <div key={wf.id}
                className={cn('border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5',
                  wf.required_plan === 'scale' ? 'border-[#5be3c5]/20 bg-[#5be3c5]/[0.03]' : 'border-[#ff7a18]/20 bg-[#ff7a18]/[0.04]')}>
                <div className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-xl bg-[#ff7a18]/12 border border-[#ff7a18]/20">
                  ⚡
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-[16px] font-semibold">{wf.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#ffae3c]/12 border border-[#ffae3c]/20 text-[#ffae3c] font-medium uppercase tracking-[0.08em]">
                      {wf.required_plan}+
                    </span>
                  </div>
                  <p className="text-[13.5px] text-[#9a9a9d]">{wf.description}</p>
                </div>
                <WorkforceRunButton workforce={wf} canRun={canRun(wf.required_plan)} />
              </div>
            ))
          )}
          <div className="p-5 rounded-2xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-2">Mapping Workforces</div>
            <p className="text-[13.5px] text-[#9a9a9d]">
              Map real Relevance AI workforce IDs in Supabase → <code className="font-mono text-[12px] text-[#5be3c5]">relevance_workforces</code> table.
            </p>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {tab === 'history' && (
        <AgentRunHistory runs={recentRuns} onSelectRun={handleSelectRun} />
      )}

      {/* ── Recommendations ── */}
      {tab === 'recommendations' && (
        <div className="flex flex-col gap-4">
          {recommendations.length === 0 ? (
            <div className="border border-white/10 rounded-2xl p-12 text-center">
              <div className="text-3xl mb-2">💡</div>
              <p className="text-[14px] text-[#6a6a6e]">No recommendations yet. Run agents to generate insights.</p>
            </div>
          ) : (
            recommendations.map((rec) => <AgentRecommendationCard key={rec.id} rec={rec} />)
          )}
        </div>
      )}
    </>
  )
}
