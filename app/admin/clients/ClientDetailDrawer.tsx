'use client'

// Right-side client detail drawer for /admin/clients. Loads full detail,
// notes, and manual payment history on open via server actions. Tabs:
// Overview · Payments · Notes · Onboarding. All reads/writes degrade
// gracefully when the CRM-detail migration is not applied.

import { useEffect, useState, useTransition } from 'react'
import { X, Plus, FileText, CreditCard, ClipboardList, Activity } from 'lucide-react'
import type {
  AdminClientDetail, ClientNote, ClientPaymentEvent,
  PaymentStatus, AdminClientStatus, OnboardingStage, NoteType,
} from '@/lib/data/admin-clients'
import type { ClientTask, TaskStatus, TaskPriority, TaskCategory } from '@/lib/data/admin-client-tasks'
import {
  loadClientDetail, loadClientNotes, loadClientPaymentEvents,
  addClientNote, updateClientOnboarding,
} from '@/lib/actions/admin-clients'
import {
  loadClientTasks, seedDefaultClientTasks, createClientTask,
  updateClientTask, completeClientTask, reopenClientTask,
} from '@/lib/actions/admin-client-tasks'
import { getTemplateInfoForPlan } from '@/lib/admin/onboarding-task-templates'
import {
  getClientSuggestions, getSuggestionTab,
  type ClientSuggestion, type SuggestionSeverity,
} from '@/lib/admin/client-suggestions'

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  unpaid: '#ffae3c', deposit_paid: '#3b9eff', paid: '#22d093', overdue: '#ff5247', cancelled: '#6a6a6e',
}
const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid', deposit_paid: 'Deposit Paid', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
}
const STATUS_COLORS: Record<AdminClientStatus, string> = {
  active: '#22d093', onboarding: '#3b9eff', paused: '#ffae3c', churned: '#ff8a7a',
}
const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center', free: 'Free' }

const ONBOARDING_STEPS: { value: OnboardingStage; label: string; next: string }[] = [
  { value: 'not_started',       label: 'Not started',       next: 'Send the intake form to the client.' },
  { value: 'intake_needed',     label: 'Intake needed',     next: 'Collect intake details (services, hours, branding).' },
  { value: 'setup_in_progress', label: 'Setup in progress', next: 'Build the booking system and connect channels.' },
  { value: 'testing',           label: 'Testing',           next: 'Run QA and confirm the booking flow end to end.' },
  { value: 'live',              label: 'Live',              next: 'Monitor first bookings and confirm notifications.' },
  { value: 'complete',          label: 'Complete',          next: 'Onboarding complete — focus on retention and upsell.' },
]

const NOTE_TYPE_OPTIONS: { value: NoteType; label: string }[] = [
  { value: 'general',    label: 'General'    },
  { value: 'payment',    label: 'Payment'    },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'support',    label: 'Support'    },
  { value: 'retention',  label: 'Retention'  },
]

type Tab = 'overview' | 'payments' | 'notes' | 'onboarding'

interface Props {
  clientId:        string
  reloadKey:       number          // bump to force a reload (e.g. after payment update)
  onClose:         () => void
  onUpdatePayment: () => void       // ask parent to open the payment modal
  onChanged:       () => void       // bubble up so the list/KPIs refresh
}

export default function ClientDetailDrawer({ clientId, reloadKey, onClose, onUpdatePayment, onChanged }: Props) {
  const [tab,      setTab]      = useState<Tab>('overview')
  const [detail,   setDetail]   = useState<AdminClientDetail | null>(null)
  const [notes,    setNotes]    = useState<ClientNote[]>([])
  const [notesMig, setNotesMig] = useState(false)
  const [events,   setEvents]   = useState<ClientPaymentEvent[]>([])
  const [eventsMig, setEventsMig] = useState(false)
  const [tasks,    setTasks]    = useState<ClientTask[]>([])
  const [tasksMig, setTasksMig] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [, startLoad]           = useTransition()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    startLoad(async () => {
      const [d, n, e, t] = await Promise.all([
        loadClientDetail(clientId),
        loadClientNotes(clientId),
        loadClientPaymentEvents(clientId),
        loadClientTasks(clientId),
      ])
      if (cancelled) return
      setDetail(d)
      setNotes(n.rows); setNotesMig(n.migrationNeeded)
      setEvents(e.rows); setEventsMig(e.migrationNeeded)
      setTasks(t.rows); setTasksMig(t.migrationNeeded)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [clientId, reloadKey])

  // Escape to close
  useEffect(() => {
    function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function reloadDrawer() { onChanged() ; /* parent bumps reloadKey */ }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      <div className="relative h-full w-full max-w-[560px] bg-[#0b0c0e] border-l border-white/[0.10] shadow-2xl
                      flex flex-col animate-[slideIn_.2s_ease-out]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-white truncate">
              {detail?.business_name ?? (loading ? 'Loading…' : 'Client')}
            </h2>
            {detail && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Pill color={STATUS_COLORS[detail.status]} label={detail.status} />
                <Pill color={PAYMENT_COLORS[detail.payment_status]} label={PAYMENT_LABELS[detail.payment_status]} />
                {tasks.length > 0 && (
                  <span className="text-[11px] text-[#9a9a9d] tabular-nums">
                    {tasks.filter((t) => t.status === 'done').length}/{tasks.length} onboarding
                  </span>
                )}
                {detail.plan && (
                  <span className="text-[11px] text-[#9a9a9d]">{PLAN_LABELS[detail.plan] ?? detail.plan}</span>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close drawer"
                  className="text-[#6a6a6e] hover:text-white transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 border-b border-white/[0.06] shrink-0">
          <TabButton icon={<ClipboardList size={13} />} label="Overview"   active={tab === 'overview'}   onClick={() => setTab('overview')} />
          <TabButton icon={<CreditCard size={13} />}    label="Payments"   active={tab === 'payments'}   onClick={() => setTab('payments')} />
          <TabButton icon={<FileText size={13} />}      label="Notes"      active={tab === 'notes'}      onClick={() => setTab('notes')} />
          <TabButton icon={<Activity size={13} />}      label="Onboarding" active={tab === 'onboarding'} onClick={() => setTab('onboarding')} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="text-[13px] text-[#6a6a6e]">Loading client details…</div>
          ) : !detail ? (
            <div className="text-[13px] text-[#ff8a7a]">Client not found or unavailable.</div>
          ) : tab === 'overview' ? (
            <OverviewTab detail={detail} notes={notes} events={events} tasks={tasks} onGoToTab={setTab} />
          ) : tab === 'payments' ? (
            <PaymentsTab detail={detail} events={events} migrationNeeded={eventsMig} onUpdatePayment={onUpdatePayment} />
          ) : tab === 'notes' ? (
            <NotesTab clientId={clientId} notes={notes} migrationNeeded={notesMig} onChanged={reloadDrawer} />
          ) : (
            <OnboardingTab clientId={clientId} detail={detail} tasks={tasks} tasksMig={tasksMig} onChanged={reloadDrawer} />
          )}
        </div>
      </div>

      <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: .6 } to { transform: translateX(0); opacity: 1 } }`}</style>
    </div>
  )
}

// ── Overview ───────────────────────────────────────────────────────
const SUGGESTION_COLORS: Record<SuggestionSeverity, string> = {
  critical: '#ff5247', warning: '#ffae3c', info: '#3b9eff', success: '#22d093',
}

function OverviewTab({
  detail, notes, events, tasks, onGoToTab,
}: {
  detail: AdminClientDetail; notes: ClientNote[]; events: ClientPaymentEvent[]
  tasks: ClientTask[]; onGoToTab: (t: Tab) => void
}) {
  const mrr = detail.status === 'active' ? detail.monthly_fee : 0
  const suggestions = getClientSuggestions(detail, tasks)
  const primary = suggestions[0] ?? null
  const secondary = suggestions.slice(1, 4)

  return (
    <div className="flex flex-col gap-5">
      {/* Suggestions (read-only recommendations) */}
      <Section title="Client Suggestions">
        {!primary ? (
          <p className="text-[12.5px] text-[#9a9a9d]">No client suggestions need attention.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            <SuggestionCard s={primary} onGoToTab={onGoToTab} primary />
            {secondary.map((s) => (
              <SuggestionCard key={s.id} s={s} onGoToTab={onGoToTab} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Client Overview">
        <Field label="Contact"   value={detail.contact_name} />
        <Field label="Email"     value={detail.email} />
        <Field label="Phone"     value={detail.phone} />
        <Field label="Website"   value={detail.website} />
        <Field label="Industry"  value={detail.industry} />
        <Field label="City"      value={detail.city} />
        <Field label="Status"    value={detail.status} />
        <Field label="Client since" value={detail.client_since ? new Date(detail.client_since).toLocaleDateString() : null} />
        <Field label="Source audit" value={detail.source_audit_id} mono />
        <Field label="Source lead"  value={detail.source_lead_id} mono />
      </Section>

      <Section title="Revenue & Plan">
        <Field label="Plan"        value={PLAN_LABELS[detail.plan] ?? detail.plan} />
        <Field label="Setup fee"   value={`$${detail.setup_fee.toLocaleString()}`} />
        <Field label="Monthly fee" value={`$${detail.monthly_fee.toLocaleString()}/mo`} />
        <Field label="Est. MRR contribution" value={`$${mrr.toLocaleString()}/mo`} />
        <p className="text-[10.5px] text-[#6a6a6e] mt-1">
          Estimated — based on stored fees. Not verified by PayPal.
        </p>
      </Section>

      <Section title="Activity Timeline">
        <Timeline detail={detail} notes={notes} events={events} />
      </Section>
    </div>
  )
}

// ── Payments ───────────────────────────────────────────────────────
function PaymentsTab({
  detail, events, migrationNeeded, onUpdatePayment,
}: {
  detail: AdminClientDetail; events: ClientPaymentEvent[]; migrationNeeded: boolean; onUpdatePayment: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Current Payment State"
        action={
          <button type="button" onClick={onUpdatePayment}
            className="text-[11.5px] font-medium px-2.5 py-1 rounded-lg bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]
                       hover:bg-[#ff7a18]/25 hover:text-white transition-all">
            Update payment
          </button>
        }>
        <Field label="Payment status" value={PAYMENT_LABELS[detail.payment_status]} />
        <Field label="Payment method" value={detail.payment_method} />
        <Field label="Last payment"   value={detail.last_payment_date ? new Date(detail.last_payment_date).toLocaleDateString() : null} />
        <Field label="Next due"       value={detail.next_payment_due ? new Date(detail.next_payment_due).toLocaleDateString() : null} />
        <Field label="PayPal invoice" value={detail.paypal_invoice_id} mono />
        <p className="text-[10.5px] text-[#6a6a6e] mt-1">Manual tracking — no PayPal API verification.</p>
      </Section>

      <Section title="Payment History">
        {migrationNeeded ? (
          <Empty text="Apply the CRM-detail migration to store payment history." />
        ) : events.length === 0 ? (
          <Empty text="No payment events recorded yet. Each payment update is logged here." />
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((e) => (
              <div key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Pill color={PAYMENT_COLORS[e.payment_status]} label={PAYMENT_LABELS[e.payment_status]} />
                  <span className="text-[10.5px] text-[#6a6a6e] tabular-nums">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1.5 text-[12px] text-[#9a9a9d] flex flex-wrap gap-x-4 gap-y-0.5">
                  {e.amount !== null && <span>Amount: ${e.amount.toLocaleString()}</span>}
                  {e.payment_method && <span>Via: {e.payment_method}</span>}
                  {e.next_payment_due && <span>Next due: {new Date(e.next_payment_due).toLocaleDateString()}</span>}
                  {e.paypal_invoice_id && <span className="font-mono">Inv: {e.paypal_invoice_id}</span>}
                </div>
                {e.notes && <p className="mt-1 text-[12px] text-[#cfd3dc]">{e.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Notes ──────────────────────────────────────────────────────────
function NotesTab({
  clientId, notes, migrationNeeded, onChanged,
}: {
  clientId: string; notes: ClientNote[]; migrationNeeded: boolean; onChanged: () => void
}) {
  const [text, setText] = useState('')
  const [type, setType] = useState<NoteType>('general')
  const [err,  setErr]  = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  function save() {
    setErr(null)
    startSave(async () => {
      const result = await addClientNote(clientId, text, type)
      if (result.ok) { setText(''); setType('general'); onChanged() }
      else setErr(result.error ?? 'Could not save note.')
    })
  }

  if (migrationNeeded) {
    return <Empty text="Apply the notes migration to enable client notes." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 flex flex-col gap-2.5">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="Add a note about this client…"
          className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] text-white
                     placeholder-[#6a6a6e] resize-none focus:outline-none focus:border-[#ff7a18]/40 transition-all"
        />
        <div className="flex items-center gap-2.5">
          <select value={type} onChange={(e) => setType(e.target.value as NoteType)}
                  className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-[#0f1012] text-[12px] text-white cursor-pointer
                             focus:outline-none focus:border-[#ff7a18]/40">
            {NOTE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" onClick={save} disabled={saving || text.trim().length === 0}
                  className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg
                             bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]
                             hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={12} /> {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
        {err && <p className="text-[12px] text-[#ff8a7a]">{err}</p>}
      </div>

      {notes.length === 0 ? (
        <Empty text="No notes yet. Add the first note above." />
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ffae3c]">{n.note_type}</span>
                <span className="text-[10.5px] text-[#6a6a6e] tabular-nums">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-[#cfd3dc] whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Onboarding ─────────────────────────────────────────────────────
const TASK_STATUS_CFG: Record<TaskStatus, { label: string; color: string }> = {
  todo:        { label: 'To do',       color: '#6a6a6e' },
  in_progress: { label: 'In progress', color: '#3b9eff' },
  blocked:     { label: 'Blocked',     color: '#ff5247' },
  done:        { label: 'Done',        color: '#22d093' },
}
const TASK_PRIORITY_CFG: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: '#6a6a6e' },
  normal: { label: 'Normal', color: '#9a9a9d' },
  high:   { label: 'High',   color: '#ffae3c' },
  urgent: { label: 'Urgent', color: '#ff5247' },
}
const TASK_CATEGORIES: TaskCategory[] = ['onboarding', 'setup', 'automation', 'communication', 'QA', 'handoff', 'support']
const TASK_STATUS_OPTIONS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done']
const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

function OnboardingTab({
  clientId, detail, tasks, tasksMig, onChanged,
}: {
  clientId: string; detail: AdminClientDetail; tasks: ClientTask[]; tasksMig: boolean; onChanged: () => void
}) {
  const [stage, setStage] = useState<OnboardingStage>(detail.onboarding_stage)
  const [notes, setNotes] = useState(detail.onboarding_notes ?? '')
  const [err,   setErr]   = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [busy,   startBusy]  = useTransition()
  const [modalTask, setModalTask] = useState<ClientTask | null | undefined>(undefined) // undefined=closed, null=create

  const current = ONBOARDING_STEPS.find((s) => s.value === stage) ?? ONBOARDING_STEPS[0]

  const total     = tasks.length
  const done      = tasks.filter((t) => t.status === 'done').length
  const blocked   = tasks.filter((t) => t.status === 'blocked').length
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone   = total > 0 && done === total
  const tmpl      = getTemplateInfoForPlan(detail.plan)
  const today     = new Date().toISOString().slice(0, 10)
  const soonIso   = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  // Sort: blocked → overdue → due soon → in progress → todo → done.
  const sortedTasks = [...tasks].sort(
    (a, b) => taskRank(a, today, soonIso) - taskRank(b, today, soonIso) || dueCmp(a, b),
  )

  function save() {
    setErr(null)
    startSave(async () => {
      const result = await updateClientOnboarding(clientId, stage, notes)
      if (result.ok) onChanged()
      else setErr(result.error ?? 'Could not update onboarding.')
    })
  }

  function markStageComplete() {
    setErr(null)
    setStage('complete')
    startSave(async () => {
      const result = await updateClientOnboarding(clientId, 'complete', notes)
      if (result.ok) onChanged()
      else setErr(result.error ?? 'Could not update onboarding.')
    })
  }

  function seed() {
    setErr(null)
    startBusy(async () => {
      const result = await seedDefaultClientTasks(clientId)
      if (result.ok) onChanged()
      else setErr(result.error ?? 'Could not create the checklist.')
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      {total > 0 && (
        <Section title="Onboarding Progress">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-[#9a9a9d]">{done} / {total} complete</span>
              <span className="text-[#ffae3c] font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${pct}%`, background: allDone ? '#22d093' : '#ff7a18' }} />
            </div>
            {blocked > 0 && (
              <p className="text-[11.5px] text-[#ff8a7a]">⚠ {blocked} task{blocked !== 1 ? 's' : ''} blocked — onboarding at risk.</p>
            )}
            {allDone && (
              <div className="rounded-xl border border-[#22d093]/25 bg-[#22d093]/[0.05] px-3.5 py-2.5 mt-1">
                <p className="text-[12.5px] text-[#cfd3dc]">Onboarding checklist complete. Review the client and mark them live when ready.</p>
                {stage !== 'complete' && (
                  <button type="button" onClick={markStageComplete} disabled={saving}
                          className="mt-2 text-[12px] font-medium px-2.5 py-1 rounded-lg bg-[#22d093]/[0.14] border border-[#22d093]/40 text-[#22d093]
                                     hover:bg-[#22d093]/25 hover:text-white transition-all disabled:opacity-50">
                    Mark onboarding stage complete
                  </button>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Stage */}
      <Section title="Onboarding Stage">
        <div className="flex flex-col gap-3">
          <select value={stage} onChange={(e) => setStage(e.target.value as OnboardingStage)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012] text-[13px] text-white cursor-pointer
                             focus:outline-none focus:border-[#ff7a18]/40">
            {ONBOARDING_STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="rounded-xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.04] px-3.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6a6a6e]">Recommended next action</p>
            <p className="text-[12.5px] text-[#cfd3dc] mt-1">{current.next}</p>
          </div>
          {detail.onboarding_completed_at && (
            <p className="text-[11.5px] text-[#22d093]">
              Completed {new Date(detail.onboarding_completed_at).toLocaleDateString()}
            </p>
          )}
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Internal onboarding notes…"
            className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white
                       placeholder-[#6a6a6e] resize-none focus:outline-none focus:border-[#ff7a18]/40 transition-all"
          />
          <button type="button" onClick={save} disabled={saving}
                  className="self-start text-[12.5px] font-medium px-3.5 py-1.5 rounded-lg
                             bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]
                             hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Update stage & notes'}
          </button>
        </div>
      </Section>

      {/* Checklist */}
      <Section title="Checklist"
        action={
          !tasksMig && total > 0 ? (
            <button type="button" onClick={() => setModalTask(null)}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded-lg
                         bg-white/[0.04] border border-white/[0.10] text-[#cfd3dc] hover:bg-white/[0.08] hover:text-white transition-all">
              <Plus size={11} /> Add task
            </button>
          ) : undefined
        }>
        <p className="text-[11px] text-[#6a6a6e] mb-2">
          Template: <span className="text-[#9a9a9d] font-medium">{tmpl.isFallback ? 'Starter fallback' : tmpl.label}</span>
        </p>
        {tasksMig ? (
          <Empty text="Apply the onboarding tasks migration to enable client task tracking." />
        ) : total === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <Empty text="No onboarding tasks yet. Create a checklist to track client delivery." />
            <button type="button" onClick={seed} disabled={busy}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3.5 py-2 rounded-xl
                               bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]
                               hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50">
              <Plus size={12} /> {busy ? 'Creating…' : `Create ${tmpl.label} checklist`}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedTasks.map((t) => (
              <TaskRow key={t.id} task={t} onChanged={onChanged} onEdit={() => setModalTask(t)} />
            ))}
          </div>
        )}
      </Section>

      {err && <p className="text-[12px] text-[#ff8a7a]">{err}</p>}

      {modalTask !== undefined && (
        <TaskModal
          clientId={clientId}
          task={modalTask}
          onClose={() => setModalTask(undefined)}
          onSaved={() => { setModalTask(undefined); onChanged() }}
        />
      )}
    </div>
  )
}

// Sort rank: blocked → overdue → due soon → in progress → todo → done.
function taskRank(t: ClientTask, today: string, soon: string): number {
  if (t.status === 'blocked') return 0
  if (t.status !== 'done' && t.due_date && t.due_date < today) return 1
  if (t.status !== 'done' && t.due_date && t.due_date >= today && t.due_date <= soon) return 2
  if (t.status === 'in_progress') return 3
  if (t.status === 'todo') return 4
  return 5
}
// Earlier due dates first; tasks without due dates sort last.
function dueCmp(a: ClientTask, b: ClientTask): number {
  if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  if (a.due_date) return -1
  if (b.due_date) return 1
  return 0
}

function TaskRow({ task, onChanged, onEdit }: { task: ClientTask; onChanged: () => void; onEdit: () => void }) {
  const [busy, startBusy] = useTransition()
  const s = TASK_STATUS_CFG[task.status]
  const p = TASK_PRIORITY_CFG[task.priority]
  const today   = new Date().toISOString().slice(0, 10)
  const soonIso = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const overdue = task.status !== 'done' && !!task.due_date && task.due_date < today
  const dueSoon = task.status !== 'done' && !!task.due_date && task.due_date >= today && task.due_date <= soonIso

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startBusy(async () => {
      const r = await fn()
      if (r.ok) onChanged()
      else alert(r.error ?? 'Action failed. Try again.')
    })
  }

  return (
    <div className={`rounded-xl border px-3.5 py-2.5 ${task.status === 'done' ? 'border-white/[0.05] bg-white/[0.015] opacity-80' : 'border-white/[0.07] bg-white/[0.02]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[13px] leading-snug ${task.status === 'done' ? 'text-[#9a9a9d] line-through' : 'text-white'}`}>{task.title}</p>
          {task.description && <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">{task.description}</p>}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Pill color={s.color} label={s.label} />
            <Pill color={p.color} label={p.label} />
            {overdue && <Pill color="#ff5247" label="Overdue" />}
            {!overdue && dueSoon && <Pill color="#ffae3c" label="Due soon" />}
            <span className="text-[10px] text-[#6a6a6e] uppercase tracking-[0.06em]">{task.category}</span>
            {task.due_date && (
              <span className="text-[10.5px] tabular-nums" style={{ color: overdue ? '#ff5247' : '#6a6a6e' }}>
                · due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px]">
        {task.status !== 'done' ? (
          <>
            {task.status === 'todo' && (
              <button type="button" disabled={busy} onClick={() => run(() => updateClientTask(task.id, { status: 'in_progress' }))}
                      className="text-[#3b9eff] hover:text-[#7ec0ff] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Start</button>
            )}
            {task.status !== 'blocked' && (
              <button type="button" disabled={busy} onClick={() => run(() => updateClientTask(task.id, { status: 'blocked' }))}
                      className="text-[#ff8a7a] hover:text-[#ffb0a4] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Block</button>
            )}
            <button type="button" disabled={busy} onClick={() => run(() => completeClientTask(task.id))}
                    className="text-[#22d093] hover:text-[#5be4b5] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Done</button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => reopenClientTask(task.id))}
                  className="text-[#ffae3c] hover:text-[#ffce7a] transition-colors disabled:opacity-50 focus:outline-none focus:underline">Reopen</button>
        )}
        <button type="button" disabled={busy} onClick={onEdit}
                className="text-[#9a9a9d] hover:text-white transition-colors disabled:opacity-50 focus:outline-none focus:underline ml-auto">Edit</button>
      </div>
    </div>
  )
}

function TaskModal({
  clientId, task, onClose, onSaved,
}: {
  clientId: string; task: ClientTask | null; onClose: () => void; onSaved: () => void
}) {
  const editing = task !== null
  const [title, setTitle]       = useState(task?.title ?? '')
  const [desc,  setDesc]        = useState(task?.description ?? '')
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'onboarding')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal')
  const [status, setStatus]     = useState<TaskStatus>(task?.status ?? 'todo')
  const [due,    setDue]        = useState(task?.due_date ?? '')
  const [err,    setErr]        = useState<string | null>(null)
  const [saving, startSave]     = useTransition()

  function save() {
    setErr(null)
    startSave(async () => {
      const r = editing
        ? await updateClientTask(task!.id, { title, description: desc, status, category, priority, due_date: due })
        : await createClientTask(clientId, { title, description: desc, category, priority, due_date: due })
      if (r.ok) onSaved()
      else setErr(r.error ?? 'Could not save task.')
    })
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 transition-all'
  const labelCls = 'text-[11px] font-medium text-[#9a9a9d] mb-1 block'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
         role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[460px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
          <h2 className="text-[15px] font-semibold text-white">{editing ? 'Edit task' : 'Add task'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors mt-0.5"><X size={14} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Optional details…" className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className={`${inputCls} cursor-pointer`}>
                {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={`${inputCls} cursor-pointer`}>
                {TASK_PRIORITY_OPTIONS.map((pr) => <option key={pr} value={pr}>{TASK_PRIORITY_CFG[pr].label}</option>)}
              </select>
            </div>
            {editing && (
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={`${inputCls} cursor-pointer`}>
                  {TASK_STATUS_OPTIONS.map((st) => <option key={st} value={st}>{TASK_STATUS_CFG[st].label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
            </div>
          </div>
          {err && <p className="text-[12px] text-[#ff8a7a]">{err}</p>}
        </div>
        <div className="flex justify-end gap-2.5 px-5 pb-5">
          <button type="button" onClick={onClose} disabled={saving}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#9a9a9d] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving || title.trim().length === 0}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : editing ? 'Save task' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Activity timeline (built from detail + notes + events) ─────────
function Timeline({ detail, notes, events }: { detail: AdminClientDetail; notes: ClientNote[]; events: ClientPaymentEvent[] }) {
  type Item = { at: string; label: string; color: string }
  const items: Item[] = []

  items.push({ at: detail.created_at, label: 'Client created', color: '#6db4ff' })
  if (detail.onboarding_completed_at) {
    items.push({ at: detail.onboarding_completed_at, label: 'Onboarding completed', color: '#22d093' })
  }
  for (const e of events) {
    items.push({ at: e.created_at, label: `Payment marked ${PAYMENT_LABELS[e.payment_status]}`, color: PAYMENT_COLORS[e.payment_status] })
  }
  for (const n of notes) {
    items.push({ at: n.created_at, label: `Note added (${n.note_type})`, color: '#ffae3c' })
  }

  const sorted = items
    .filter((i) => i.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 14)

  if (sorted.length === 0) return <Empty text="No activity yet." />

  return (
    <div className="flex flex-col gap-0.5">
      {sorted.map((i, idx) => (
        <div key={idx} className="flex items-start gap-2.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: i.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-[#cfd3dc] leading-snug">{i.label}</p>
            <p className="text-[10.5px] text-[#6a6a6e] tabular-nums">{new Date(i.at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Read-only suggestion card. The button only switches drawer tabs — it
// never performs a backend change.
function SuggestionCard({ s, onGoToTab, primary }: { s: ClientSuggestion; onGoToTab: (t: Tab) => void; primary?: boolean }) {
  const color = SUGGESTION_COLORS[s.severity]
  return (
    <div className="rounded-xl border px-3.5 py-3"
         style={{ borderColor: `${color}33`, background: primary ? `${color}10` : 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border capitalize"
              style={{ color, borderColor: `${color}33`, background: `${color}12` }}>
          {s.severity}
        </span>
        <span className="text-[13px] font-semibold text-white">{s.title}</span>
      </div>
      <p className="text-[12px] text-[#9a9a9d] mt-1.5 leading-snug">{s.description}</p>
      <p className="text-[12px] text-[#cfd3dc] mt-1.5">
        <span className="text-[#6a6a6e]">Recommended: </span>{s.recommendedAction}
      </p>
      <button
        type="button"
        onClick={() => onGoToTab(getSuggestionTab(s.actionType))}
        className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-lg
                   bg-white/[0.04] border border-white/[0.12] text-[#cfd3dc] hover:bg-white/[0.08] hover:text-white transition-all"
      >
        Go to {getSuggestionTab(s.actionType)}
      </button>
    </div>
  )
}

// ── Small presentational helpers ───────────────────────────────────
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#0f1012]/70 overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/[0.05]">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9a9a9d]">{title}</h3>
        {action}
      </header>
      <div className="px-4 py-3.5 flex flex-col gap-2 text-[13px]">{children}</div>
    </section>
  )
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#6a6a6e] shrink-0">{label}</span>
      <span className={`text-white text-right break-words ${mono ? 'font-mono text-[11.5px]' : ''}`}>
        {value && value.length > 0 ? value : '—'}
      </span>
    </div>
  )
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap capitalize"
          style={{ color, borderColor: `${color}33`, background: `${color}12` }}>
      {label}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-[12.5px] text-[#6a6a6e] py-1">{text}</p>
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium border-b-2 transition-colors
        ${active ? 'border-[#ff7a18] text-white' : 'border-transparent text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
      {icon} {label}
    </button>
  )
}
