'use client'

import { useState, useTransition } from 'react'
import { createAutomationRule, updateAutomationRule } from '@/lib/actions/ops'
import type { AutomationRule } from '@/lib/ops/automation'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  rule?:    AutomationRule | null
  onClose:  () => void
  onSaved:  () => void
}

const SOURCES      = ['','chat','whatsapp','calcom','stripe','relevance','system','widget']
const SEVERITIES   = ['','info','warning','error','critical']
const ACTION_TYPES = ['create_alert','create_task','create_approval','ignore']
const PRIORITIES   = ['low','normal','high','urgent']

export default function AutomationRuleForm({ rule, onClose, onSaved }: Props) {
  const isEdit = !!rule

  const [name,       setName]       = useState(rule?.name ?? '')
  const [desc,       setDesc]       = useState(rule?.description ?? '')
  const [source,     setSource]     = useState(rule?.trigger_source ?? '')
  const [eventType,  setEventType]  = useState(rule?.trigger_event_type ?? '')
  const [severity,   setSeverity]   = useState(rule?.trigger_severity ?? '')
  const [actionType, setActionType] = useState<'create_alert'|'create_task'|'create_approval'|'ignore'>(rule?.action_type ?? 'create_alert')
  const [titleTmpl,  setTitleTmpl]  = useState(rule?.action_title_template ?? '')
  const [descTmpl,   setDescTmpl]   = useState(rule?.action_description_template ?? '')
  const [priority,   setPriority]   = useState(rule?.priority ?? 'normal')
  const [isEnabled,  setIsEnabled]  = useState(rule?.is_enabled ?? true)
  const [error,      setError]      = useState<string | null>(null)

  const [pending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!titleTmpl.trim()) { setError('Action title template is required.'); return }
    setError(null)

    const data = {
      name:                        name.trim(),
      description:                 desc.trim() || undefined,
      trigger_source:              source || undefined,
      trigger_event_type:          eventType.trim() || undefined,
      trigger_severity:            (severity as 'info'|'warning'|'error'|'critical'|undefined) || undefined,
      action_type:                 actionType as 'create_alert'|'create_task'|'create_approval'|'ignore',
      action_title_template:       titleTmpl.trim(),
      action_description_template: descTmpl.trim() || undefined,
      priority:                    priority as 'low'|'normal'|'high'|'urgent',
      is_enabled:                  isEnabled,
    }

    startTransition(async () => {
      if (isEdit && rule) {
        const result = await updateAutomationRule(rule.id, data)
        if (result.error) { setError(result.error); return }
        capture('ops_automation_rule_updated', {})
      } else {
        const result = await createAutomationRule(data)
        if (result.error) { setError(result.error); return }
        capture('ops_automation_rule_created', {})
      }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Name *">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={128} placeholder="e.g. Payment failed → alert"
          className={inputClass} />
      </Field>

      <Field label="Description">
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} rows={2} placeholder="Optional description"
          className={`${inputClass} resize-none`} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Trigger Source">
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            {SOURCES.map((s) => <option key={s} value={s}>{s || 'Any source'}</option>)}
          </select>
        </Field>
        <Field label="Trigger Severity">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s || 'Any severity'}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Trigger Event Type" hint="Use * as wildcard, e.g. *failed*">
        <input value={eventType} onChange={(e) => setEventType(e.target.value)} maxLength={128} placeholder="e.g. payment_failed or *failed*"
          className={inputClass} />
      </Field>

      <div className="border-t border-white/[0.06] pt-4" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Action Type *">
          <select value={actionType} onChange={(e) => setActionType(e.target.value as 'create_alert'|'create_task'|'create_approval'|'ignore')} className={inputClass}>
            {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Action Title Template *" hint="Use {{source}}, {{event_type}}, {{severity}}, {{title}}">
        <input value={titleTmpl} onChange={(e) => setTitleTmpl(e.target.value)} maxLength={256} placeholder="e.g. Failure: {{title}}"
          className={inputClass} />
      </Field>

      <Field label="Action Description Template">
        <textarea value={descTmpl} onChange={(e) => setDescTmpl(e.target.value)} maxLength={2000} rows={2}
          placeholder="Optional — supports same template variables"
          className={`${inputClass} resize-none`} />
      </Field>

      <label className="flex items-center gap-3 cursor-pointer">
        <button type="button" onClick={() => setIsEnabled((v) => !v)}
          className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? 'bg-[#22d093]' : 'bg-white/[0.12]'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
        <span className="text-[13px] text-[#9a9a9d]">Enabled</span>
      </label>

      {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

      <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
        <button onClick={handleSubmit} disabled={pending}
          className="h-9 px-5 rounded-[10px] text-[13px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
          {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rule'}
        </button>
        <button onClick={onClose} className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] transition-all">
          Cancel
        </button>
      </div>
    </div>
  )
}

const inputClass = 'w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[13px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-semibold text-[#9a9a9d]">{label}</label>
        {hint && <span className="text-[10px] text-[#6a6a6e]">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
