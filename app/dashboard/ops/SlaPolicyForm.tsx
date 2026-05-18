'use client'

import { useState, useTransition } from 'react'
import { createSlaPolicy, updateSlaPolicy } from '@/lib/actions/ops'
import type { SlaPolicy } from '@/lib/ops/sla'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  policy?:  SlaPolicy | null
  onClose:  () => void
  onSaved:  () => void
}

const TARGET_TYPES = ['alert','task','approval','event','conversation']
const SOURCES      = ['','chat','whatsapp','calcom','stripe','relevance','system']
const SEVERITIES   = ['','info','warning','error','critical']
const PRIORITIES   = ['','low','normal','high','urgent']

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

export default function SlaPolicyForm({ policy, onClose, onSaved }: Props) {
  const isEdit = !!policy

  const [name,        setName]        = useState(policy?.name ?? '')
  const [targetType,  setTargetType]  = useState(policy?.target_type ?? 'alert')
  const [source,      setSource]      = useState(policy?.source ?? '')
  const [severity,    setSeverity]    = useState(policy?.severity ?? '')
  const [priority,    setPriority]    = useState(policy?.priority ?? '')
  const [respMin,     setRespMin]     = useState(String(policy?.response_minutes ?? 60))
  const [escMin,      setEscMin]      = useState(String(policy?.escalation_minutes ?? ''))
  const [isEnabled,   setIsEnabled]   = useState(policy?.is_enabled ?? true)
  const [error,       setError]       = useState<string | null>(null)

  const [pending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!name.trim()) { setError('Name is required.'); return }
    const resp = parseInt(respMin, 10)
    if (isNaN(resp) || resp < 1) { setError('Response time must be at least 1 minute.'); return }
    const esc = escMin ? parseInt(escMin, 10) : undefined
    if (escMin && (isNaN(esc!) || esc! < 1)) { setError('Escalation time must be at least 1 minute.'); return }
    setError(null)

    const data = {
      name:               name.trim(),
      target_type:        targetType as 'event'|'alert'|'task'|'approval'|'conversation',
      source:             source || undefined,
      severity:           (severity as 'info'|'warning'|'error'|'critical'|undefined) || undefined,
      priority:           (priority as 'low'|'normal'|'high'|'urgent'|undefined) || undefined,
      response_minutes:   resp,
      escalation_minutes: esc,
      is_enabled:         isEnabled,
    }

    startTransition(async () => {
      if (isEdit && policy) {
        const result = await updateSlaPolicy(policy.id, data)
        if (result.error) { setError(result.error); return }
        capture('ops_sla_policy_updated', {})
      } else {
        const result = await createSlaPolicy(data)
        if (result.error) { setError(result.error); return }
        capture('ops_sla_policy_created', {})
      }
      onSaved(); onClose()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Name *">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={128} placeholder="e.g. Critical alerts — 15 min" className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Target Type *">
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className={inputClass}>
            {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
            {SOURCES.map((s) => <option key={s} value={s}>{s || 'Any'}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s || 'Any'}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p || 'Any'}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Response Time (minutes) *" hint="SLA deadline">
          <input type="number" min="1" max="43200" value={respMin} onChange={(e) => setRespMin(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Escalation After (minutes)" hint="optional">
          <input type="number" min="1" max="43200" value={escMin} onChange={(e) => setEscMin(e.target.value)} placeholder="e.g. 120" className={inputClass} />
        </Field>
      </div>

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
          {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Policy'}
        </button>
        <button onClick={onClose} className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] transition-all">
          Cancel
        </button>
      </div>
    </div>
  )
}
