'use client'

import { useState, useTransition } from 'react'
import { createNotificationRule, updateNotificationRule } from '@/lib/actions/ops'
import type { NotificationRule, BusinessMember } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  rule?:    NotificationRule | null
  members:  BusinessMember[]
  onClose:  () => void
  onSaved:  () => void
}

const TRIGGER_TYPES = [
  'alert_created','task_created','approval_created','item_assigned',
  'sla_warning','sla_breached','escalation_created','automation_failed',
  'payment_failed','booking_failed','handoff_requested',
]
const CHANNELS        = ['email','dashboard','none']
const RECIPIENT_TYPES = ['owner','assigned_user','all_admins','custom_email']
const SEVERITIES      = ['','info','warning','error','critical']
const SOURCES         = ['','chat','whatsapp','calcom','stripe','relevance','system']

const inputClass = 'w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[13px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11.5px] font-semibold text-[#9a9a9d]">{label}</label>
      {children}
    </div>
  )
}

export default function NotificationRuleForm({ rule, members, onClose, onSaved }: Props) {
  const isEdit = !!rule

  const [name,          setName]          = useState(rule?.name ?? '')
  const [desc,          setDesc]          = useState((rule as { description?: string } | null)?.description ?? '')
  const [triggerType,   setTriggerType]   = useState(rule?.trigger_type ?? 'alert_created')
  const [source,        setSource]        = useState(rule?.source ?? '')
  const [severity,      setSeverity]      = useState(rule?.severity ?? '')
  const [channel,       setChannel]       = useState(rule?.channel ?? 'email')
  const [recipientType, setRecipientType] = useState(rule?.recipient_type ?? 'owner')
  const [recipientEmail,setRecipientEmail]= useState(rule?.recipient_email ?? '')
  const [recipientUser, setRecipientUser] = useState(rule?.recipient_user_id ?? '')
  const [delayMin,      setDelayMin]      = useState(String(rule?.delay_minutes ?? 0))
  const [isEnabled,     setIsEnabled]     = useState(rule?.is_enabled ?? true)
  const [error,         setError]         = useState<string | null>(null)

  const [pending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (!name.trim()) { setError('Name is required.'); return }
    if (channel === 'email' && recipientType === 'custom_email' && !recipientEmail.trim()) {
      setError('Recipient email is required for custom email.'); return
    }
    setError(null)

    const data = {
      name:              name.trim(),
      description:       desc.trim() || undefined,
      trigger_type:      triggerType as 'alert_created'|'task_created'|'approval_created'|'item_assigned'|'sla_warning'|'sla_breached'|'escalation_created'|'automation_failed'|'payment_failed'|'booking_failed'|'handoff_requested',
      source:            source || undefined,
      severity:          (severity as 'info'|'warning'|'error'|'critical'|undefined) || undefined,
      channel:           channel as 'email'|'dashboard'|'none',
      recipient_type:    recipientType as 'owner'|'assigned_user'|'all_admins'|'custom_email',
      recipient_user_id: recipientUser || undefined,
      recipient_email:   recipientEmail.trim() || undefined,
      delay_minutes:     Math.max(0, parseInt(delayMin, 10) || 0),
      is_enabled:        isEnabled,
    }

    startTransition(async () => {
      if (isEdit && rule) {
        const result = await updateNotificationRule(rule.id, data)
        if (result.error) { setError(result.error); return }
        capture('ops_notification_rule_updated', {})
      } else {
        const result = await createNotificationRule(data)
        if (result.error) { setError(result.error); return }
        capture('ops_notification_rule_created', {})
      }
      onSaved(); onClose()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Name *">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={128} placeholder="e.g. Critical alert → email owner" className={inputClass} />
      </Field>

      <Field label="Description">
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} rows={2} placeholder="Optional" className={`${inputClass} resize-none h-auto py-2`} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Trigger Type *">
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className={inputClass}>
            {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
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
        <Field label="Channel *">
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      {channel !== 'none' && (
        <Field label="Recipient Type *">
          <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className={inputClass}>
            {RECIPIENT_TYPES.map((r) => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
          </select>
        </Field>
      )}

      {channel === 'email' && recipientType === 'custom_email' && (
        <Field label="Recipient Email *">
          <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} maxLength={256} placeholder="recipient@example.com" className={inputClass} />
        </Field>
      )}

      {channel === 'email' && recipientType === 'assigned_user' && members.length > 0 && (
        <Field label="Default Recipient (when no assigned user)">
          <select value={recipientUser} onChange={(e) => setRecipientUser(e.target.value)} className={inputClass}>
            <option value="">Owner (fallback)</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
          </select>
        </Field>
      )}

      <Field label="Delay (minutes)">
        <input type="number" min="0" max="10080" value={delayMin} onChange={(e) => setDelayMin(e.target.value)} className={inputClass} />
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
