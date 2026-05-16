'use client'

import { useState, useTransition } from 'react'
import {
  toggleAutomationRule, seedDefaultRules, runOpsAutomationNow,
  deleteAutomationRule, duplicateAutomationRule,
} from '@/lib/actions/ops'
import type { AutomationRule } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'
import AutomationRuleDrawer from './AutomationRuleDrawer'

interface Props {
  rules:     AutomationRule[]
  onRefresh: () => void
}

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  create_alert:    { label: 'Create Alert',    color: 'text-[#ff8a7a] bg-[#ff8a7a]/10' },
  create_task:     { label: 'Create Task',     color: 'text-[#3b9eff] bg-[#3b9eff]/10' },
  create_approval: { label: 'Create Approval', color: 'text-[#ffae3c] bg-[#ffae3c]/10' },
  ignore:          { label: 'Ignore',          color: 'text-[#6a6a6e] bg-white/[0.06]'  },
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-[#ff8a7a]', high: 'text-[#ffae3c]', normal: 'text-[#9a9a9d]', low: 'text-[#6a6a6e]',
}

export default function AutomationRulesPanel({ rules, onRefresh }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editRule,   setEditRule]   = useState<AutomationRule | null>(null)
  const [seedMsg,    setSeedMsg]    = useState<string | null>(null)
  const [runMsg,     setRunMsg]     = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const [togglePending, startToggle] = useTransition()
  const [seedPending,   startSeed]   = useTransition()
  const [runPending,    startRun]    = useTransition()
  const [actionPending, startAction] = useTransition()

  const openCreate = () => { setEditRule(null); setDrawerOpen(true) }
  const openEdit   = (rule: AutomationRule) => { setEditRule(rule); setDrawerOpen(true) }
  const closeDrawer = () => { setDrawerOpen(false); setEditRule(null) }

  const handleToggle = (id: string, isEnabled: boolean) => {
    startToggle(async () => {
      await toggleAutomationRule(id, !isEnabled)
      capture('ops_automation_rule_toggled', { enabled: !isEnabled })
      onRefresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this automation rule?')) return
    startAction(async () => {
      const result = await deleteAutomationRule(id)
      if (result.error) { setError(result.error); return }
      capture('ops_automation_rule_deleted', {})
      onRefresh()
    })
  }

  const handleDuplicate = (id: string) => {
    startAction(async () => {
      const result = await duplicateAutomationRule(id)
      if (result.error) { setError(result.error); return }
      capture('ops_automation_rule_created', { duplicated: true })
      onRefresh()
    })
  }

  const handleSeed = () => {
    setSeedMsg(null); setError(null)
    startSeed(async () => {
      const result = await seedDefaultRules()
      if (result.error) { setError(result.error); return }
      setSeedMsg(`Seeded ${result.seeded} rule${result.seeded !== 1 ? 's' : ''}.`)
      onRefresh()
    })
  }

  const handleRunNow = () => {
    setRunMsg(null); setError(null)
    startRun(async () => {
      const result = await runOpsAutomationNow()
      if (result.error) { setError(result.error); return }
      capture('ops_automation_run_completed', { processed: result.processed })
      setRunMsg(`Processed ${result.processed} event${result.processed !== 1 ? 's' : ''}${result.errors > 0 ? `, ${result.errors} error${result.errors !== 1 ? 's' : ''}` : ''}.`)
      onRefresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button onClick={openCreate}
          className="h-9 px-4 rounded-[10px] text-[13px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90 transition-opacity">
          + Create Rule
        </button>
        <button onClick={handleSeed} disabled={seedPending}
          className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all disabled:opacity-40">
          {seedPending ? 'Seeding…' : '+ Seed Defaults'}
        </button>
        <button onClick={handleRunNow} disabled={runPending}
          className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] bg-white/[0.04] text-[#9a9a9d] hover:bg-white/[0.08] transition-all disabled:opacity-40">
          {runPending ? 'Running…' : '▶ Run Now'}
        </button>
      </div>

      {seedMsg && <p className="text-[12px] text-[#22d093]">{seedMsg}</p>}
      {runMsg  && <p className="text-[12px] text-[#22d093]">{runMsg}</p>}
      {error   && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[28px]">⚙</span>
          <p className="text-[13px] font-medium text-white">No automation rules</p>
          <p className="text-[12px] text-[#6a6a6e] max-w-sm">Create a custom rule or seed defaults.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/[0.04] rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden">
          {rules.map((rule) => {
            const actionCfg = ACTION_LABEL[rule.action_type] ?? ACTION_LABEL.ignore
            return (
              <div key={rule.id} className="flex items-start gap-4 px-5 py-4">
                <button onClick={() => handleToggle(rule.id, rule.is_enabled)} disabled={togglePending}
                  className={`mt-0.5 w-9 h-5 rounded-full transition-colors shrink-0 relative disabled:opacity-40 ${rule.is_enabled ? 'bg-[#22d093]' : 'bg-white/[0.12]'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.is_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[13px] font-medium ${rule.is_enabled ? 'text-white' : 'text-[#6a6a6e]'}`}>{rule.name}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${actionCfg.color}`}>{actionCfg.label}</span>
                    <span className={`text-[10px] font-semibold uppercase ${PRIORITY_COLOR[rule.priority]}`}>{rule.priority}</span>
                  </div>
                  {rule.description && <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">{rule.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {rule.trigger_source     && <TriggerPill label="Source" value={rule.trigger_source} />}
                    {rule.trigger_event_type && <TriggerPill label="Event"  value={rule.trigger_event_type} />}
                    {rule.trigger_severity   && <TriggerPill label="Sev"    value={rule.trigger_severity} />}
                    <span className="text-[10.5px] text-[#6a6a6e]">→</span>
                    <span className="text-[11px] text-white font-mono truncate">{rule.action_title_template}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openEdit(rule)}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all">
                    Edit
                  </button>
                  <button onClick={() => handleDuplicate(rule.id)} disabled={actionPending}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
                    Copy
                  </button>
                  <button onClick={() => handleDelete(rule.id)} disabled={actionPending}
                    className="h-7 px-2.5 rounded-lg text-[11px] border border-[#ff8a7a]/20 text-[#ff8a7a] hover:bg-[#ff8a7a]/10 transition-all disabled:opacity-40">
                    Del
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {drawerOpen && (
        <AutomationRuleDrawer rule={editRule} onClose={closeDrawer} onSaved={() => { onRefresh(); closeDrawer() }} />
      )}
    </div>
  )
}

function TriggerPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
      <span className="text-[#6a6a6e]">{label}:</span>
      <span className="text-[#9a9a9d] font-mono">{value}</span>
    </span>
  )
}
