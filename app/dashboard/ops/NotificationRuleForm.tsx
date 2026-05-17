'use client'

import { useState, useTransition } from 'react'
import { createNotificationRule, updateNotificationRule } from '@/lib/actions/ops'
import type { NotificationRule, BusinessMember } from '@/lib/actions/ops'
import { SAFE_TEMPLATE_VARS } from '@/lib/validation/ops'
import { capture } from '@/lib/analytics/posthog'
import NotificationPreviewDrawer from './NotificationPreviewDrawer'
import EmailTemplateLivePreview   from './EmailTemplateLivePreview'

// Client-side template validation (safe variable check only — no server-only imports)
function validateTemplate(template: string, maxLength: number): string | null {
  if (template.length > maxLength) return `Template exceeds ${maxLength} character limit.`
  const found = (template.match(/\{\{[^}]+\}\}/g) ?? []).filter((v) => !SAFE_TEMPLATE_VARS.includes(v as typeof SAFE_TEMPLATE_VARS[number]))
  if (found.length > 0) return `Unsafe template variables: ${found.join(', ')}`
  return null
}

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
const CHANNELS = ['email','dashboard','none']
const RECIPIENT_MODES = [
  { value: 'owner',           label: 'Owner' },
  { value: 'assigned_user',   label: 'Assigned User' },
  { value: 'all_admins',      label: 'All Admins' },
  { value: 'custom_email',    label: 'Custom Email' },
  { value: 'selected_users',  label: 'Selected Users' },
  { value: 'multiple_emails', label: 'Multiple Emails' },
]
const SEVERITIES = ['','info','warning','error','critical']
const SOURCES    = ['','chat','whatsapp','calcom','stripe','relevance','system']

const inputClass = 'w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[13px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors'
const textareaClass = `${inputClass} h-auto py-2 resize-none`

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

// Get extended fields from rule safely
function getExtField<T>(rule: NotificationRule | null | undefined, key: string, def: T): T {
  return (rule as unknown as Record<string, T> | null)?.[key] ?? def
}

export default function NotificationRuleForm({ rule, members, onClose, onSaved }: Props) {
  const isEdit = !!rule

  // Basic fields
  const [name,          setName]          = useState(rule?.name ?? '')
  const [desc,          setDesc]          = useState(getExtField<string>(rule, 'description', ''))
  const [triggerType,   setTriggerType]   = useState(rule?.trigger_type ?? 'alert_created')
  const [source,        setSource]        = useState(rule?.source ?? '')
  const [severity,      setSeverity]      = useState(rule?.severity ?? '')
  const [channel,       setChannel]       = useState(rule?.channel ?? 'email')
  const [recipientMode, setRecipientMode] = useState(rule?.recipient_type ?? 'owner')
  const [recipientEmail,setRecipientEmail]= useState(rule?.recipient_email ?? '')
  const [recipientUser, setRecipientUser] = useState(rule?.recipient_user_id ?? '')
  const [delayMin,      setDelayMin]      = useState(String(rule?.delay_minutes ?? 0))
  const [isEnabled,     setIsEnabled]     = useState(rule?.is_enabled ?? true)

  // Multi-recipient
  const [selectedUsers,   setSelectedUsers]   = useState<string[]>(getExtField<string[]>(rule, 'recipient_user_ids', []))
  const [customEmails,    setCustomEmails]     = useState<string[]>(getExtField<string[]>(rule, 'recipient_emails', []))
  const [newEmail,        setNewEmail]         = useState('')

  // Template fields
  const [subjectTemplate, setSubjectTemplate] = useState(getExtField<string>(rule, 'email_subject_template', ''))
  const [bodyTemplate,    setBodyTemplate]     = useState(getExtField<string>(rule, 'email_body_template', ''))
  const [subjectErr,      setSubjectErr]       = useState<string | null>(null)
  const [bodyErr,         setBodyErr]          = useState<string | null>(null)
  const [showTemplate,    setShowTemplate]     = useState(false)

  // Preview drawer
  const [previewOpen, setPreviewOpen] = useState(false)

  const [error,   setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Template validation
  const validateTemplates = (): boolean => {
    let ok = true
    if (subjectTemplate) {
      const err = validateTemplate(subjectTemplate, 256)
      setSubjectErr(err); if (err) ok = false
    } else { setSubjectErr(null) }
    if (bodyTemplate) {
      const err = validateTemplate(bodyTemplate, 2000)
      setBodyErr(err); if (err) ok = false
    } else { setBodyErr(null) }
    return ok
  }

  // Email repeater
  const addCustomEmail = () => {
    const e = newEmail.trim()
    if (!e) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Invalid email address.'); return }
    if (customEmails.length >= 10) { setError('Maximum 10 recipients.'); return }
    if (customEmails.includes(e)) { setError('Email already added.'); return }
    setCustomEmails((prev) => [...prev, e]); setNewEmail(''); setError(null)
  }
  const removeEmail = (e: string) => setCustomEmails((prev) => prev.filter((x) => x !== e))
  const toggleUser  = (uid: string) => {
    setSelectedUsers((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid].slice(0, 10))
  }

  const handleSubmit = () => {
    if (!name.trim()) { setError('Name is required.'); return }
    if (!validateTemplates()) return

    if (channel === 'email' && recipientMode === 'custom_email' && !recipientEmail.trim()) {
      setError('Recipient email is required.'); return
    }
    if (channel === 'email' && recipientMode === 'multiple_emails' && customEmails.length === 0) {
      setError('Add at least one email address.'); return
    }
    if (channel === 'email' && recipientMode === 'selected_users' && selectedUsers.length === 0) {
      setError('Select at least one team member.'); return
    }
    setError(null)

    // Phase 18: selected_users and multiple_emails are now proper backend types
    const mappedRecipientType = recipientMode as 'owner'|'assigned_user'|'all_admins'|'custom_email'|'selected_users'|'multiple_emails'

    const data = {
      name:                   name.trim(),
      description:            desc.trim() || undefined,
      trigger_type:           triggerType as Parameters<typeof createNotificationRule>[0]['trigger_type'],
      source:                 source || undefined,
      severity:               (severity as 'info'|'warning'|'error'|'critical'|undefined) || undefined,
      channel:                channel as 'email'|'dashboard'|'none',
      recipient_type:         mappedRecipientType,
      recipient_user_id:      recipientUser || undefined,
      recipient_email:        recipientMode === 'custom_email' ? (recipientEmail.trim() || undefined) : undefined,
      delay_minutes:          Math.max(0, parseInt(delayMin, 10) || 0),
      is_enabled:             isEnabled,
      // Phase 17 multi-recipient
      recipient_user_ids:     recipientMode === 'selected_users' ? selectedUsers : undefined,
      recipient_emails:       recipientMode === 'multiple_emails' ? customEmails : undefined,
      // Phase 17 template fields
      email_subject_template: subjectTemplate.trim() || undefined,
      email_body_template:    bodyTemplate.trim() || undefined,
    }

    startTransition(async () => {
      if (isEdit && rule) {
        const result = await updateNotificationRule(rule.id, data)
        if (result.error) { setError(result.error); return }
        capture('ops_notification_rule_updated', { has_template: !!(subjectTemplate || bodyTemplate) })
      } else {
        const result = await createNotificationRule(data)
        if (result.error) { setError(result.error); return }
        capture('ops_notification_rule_created', { has_template: !!(subjectTemplate || bodyTemplate) })
      }
      onSaved(); onClose()
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={128} placeholder="e.g. Critical alert → email owner" className={inputClass} />
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
          <Field label="Recipient Mode *">
            <select value={recipientMode} onChange={(e) => setRecipientMode(e.target.value)} className={inputClass}>
              {RECIPIENT_MODES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        )}

        {channel === 'email' && recipientMode === 'custom_email' && (
          <Field label="Recipient Email *">
            <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} maxLength={256} placeholder="recipient@example.com" className={inputClass} />
          </Field>
        )}

        {channel === 'email' && recipientMode === 'assigned_user' && members.length > 0 && (
          <Field label="Default Recipient (fallback)">
            <select value={recipientUser} onChange={(e) => setRecipientUser(e.target.value)} className={inputClass}>
              <option value="">Owner (fallback)</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
            </select>
          </Field>
        )}

        {channel === 'email' && recipientMode === 'selected_users' && (
          <Field label={`Select team members (${selectedUsers.length}/10)`}>
            <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto rounded-lg border border-white/[0.08] p-2 bg-white/[0.02]">
              {members.length === 0 ? (
                <p className="text-[11.5px] text-[#6a6a6e] py-2 text-center">No team members found.</p>
              ) : (
                members.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer">
                    <input type="checkbox" checked={selectedUsers.includes(m.user_id)} onChange={() => toggleUser(m.user_id)} className="accent-[#ff7a18]" />
                    <span className="text-[12.5px] text-[#9a9a9d]">{m.full_name ?? m.email}</span>
                  </label>
                ))
              )}
            </div>
          </Field>
        )}

        {channel === 'email' && recipientMode === 'multiple_emails' && (
          <Field label={`Email recipients (${customEmails.length}/10)`}>
            <div className="flex gap-2">
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEmail() } }}
                placeholder="add@example.com" maxLength={256} className={inputClass} />
              <button onClick={addCustomEmail} className="h-9 px-3 rounded-lg border border-white/[0.10] text-[#9a9a9d] text-[12.5px] hover:bg-white/[0.06] transition-all shrink-0">
                + Add
              </button>
            </div>
            {customEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {customEmails.map((e) => (
                  <span key={e} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#9a9a9d]">
                    {e}
                    <button onClick={() => removeEmail(e)} className="text-[#6a6a6e] hover:text-[#ff8a7a] transition-colors ml-0.5">✕</button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        )}

        <Field label="Delay (minutes)">
          <input type="number" min="0" max="10080" value={delayMin} onChange={(e) => setDelayMin(e.target.value)} className={inputClass} />
        </Field>

        {/* Email template section */}
        {channel === 'email' && (
          <div className="border-t border-white/[0.06] pt-3">
            <button onClick={() => setShowTemplate((v) => !v)}
              className="flex items-center gap-2 text-[12.5px] text-[#9a9a9d] hover:text-white transition-colors">
              <span>{showTemplate ? '▼' : '▶'}</span>
              Email Template (optional)
              {(subjectTemplate || bodyTemplate) && <span className="text-[10px] text-[#22d093] ml-1">● customized</span>}
            </button>

            {showTemplate && (
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Subject Template" hint="max 256 chars">
                  <input value={subjectTemplate} onChange={(e) => { setSubjectTemplate(e.target.value); setSubjectErr(null) }}
                    maxLength={256} placeholder="e.g. [{{severity}}] {{title}} — Helios AI Ops" className={inputClass} />
                  {subjectErr && <p className="text-[11px] text-[#ff8a7a] mt-1">{subjectErr}</p>}
                </Field>

                <Field label="Body Template" hint="max 2000 chars">
                  <textarea value={bodyTemplate} onChange={(e) => { setBodyTemplate(e.target.value); setBodyErr(null) }}
                    maxLength={2000} rows={4} placeholder="Use {{title}}, {{severity}}, {{source}}, {{dashboard_url}}, etc."
                    className={textareaClass} />
                  {bodyErr && <p className="text-[11px] text-[#ff8a7a] mt-1">{bodyErr}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e]">Leave empty to use the system default template.</p>
                </Field>

                {/* Live preview — updates as user types, no server calls */}
                <EmailTemplateLivePreview subject={subjectTemplate} body={bodyTemplate} />
              </div>
            )}
          </div>
        )}

        {/* Enabled toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <button type="button" onClick={() => setIsEnabled((v) => !v)}
            className={`w-9 h-5 rounded-full transition-colors relative ${isEnabled ? 'bg-[#22d093]' : 'bg-white/[0.12]'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <span className="text-[13px] text-[#9a9a9d]">Enabled</span>
        </label>

        {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

        <div className="flex gap-2 pt-2 border-t border-white/[0.06] flex-wrap">
          <button onClick={handleSubmit} disabled={pending}
            className="h-9 px-5 rounded-[10px] text-[13px] bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
            {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
          {isEdit && (
            <button onClick={() => { capture('ops_notification_preview_opened', {}); setPreviewOpen(true) }}
              className="h-9 px-4 rounded-[10px] text-[13px] border border-[#3b9eff]/30 bg-[#3b9eff]/[0.08] text-[#3b9eff] hover:bg-[#3b9eff]/15 transition-all">
              🔍 Preview
            </button>
          )}
          <button onClick={onClose} className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] transition-all">
            Cancel
          </button>
        </div>
      </div>

      {previewOpen && rule && (
        <NotificationPreviewDrawer
          ruleId={rule.id}
          ruleName={rule.name}
          triggerType={rule.trigger_type}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}
