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
import {
  loadClientDetail, loadClientNotes, loadClientPaymentEvents,
  addClientNote, updateClientOnboarding,
} from '@/lib/actions/admin-clients'

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
  const [loading,  setLoading]  = useState(true)
  const [, startLoad]           = useTransition()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    startLoad(async () => {
      const [d, n, e] = await Promise.all([
        loadClientDetail(clientId),
        loadClientNotes(clientId),
        loadClientPaymentEvents(clientId),
      ])
      if (cancelled) return
      setDetail(d)
      setNotes(n.rows); setNotesMig(n.migrationNeeded)
      setEvents(e.rows); setEventsMig(e.migrationNeeded)
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
            <OverviewTab detail={detail} notes={notes} events={events} />
          ) : tab === 'payments' ? (
            <PaymentsTab detail={detail} events={events} migrationNeeded={eventsMig} onUpdatePayment={onUpdatePayment} />
          ) : tab === 'notes' ? (
            <NotesTab clientId={clientId} notes={notes} migrationNeeded={notesMig} onChanged={reloadDrawer} />
          ) : (
            <OnboardingTab clientId={clientId} detail={detail} onChanged={reloadDrawer} />
          )}
        </div>
      </div>

      <style>{`@keyframes slideIn { from { transform: translateX(24px); opacity: .6 } to { transform: translateX(0); opacity: 1 } }`}</style>
    </div>
  )
}

// ── Overview ───────────────────────────────────────────────────────
function OverviewTab({ detail, notes, events }: { detail: AdminClientDetail; notes: ClientNote[]; events: ClientPaymentEvent[] }) {
  const mrr = detail.status === 'active' ? detail.monthly_fee : 0
  return (
    <div className="flex flex-col gap-5">
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
function OnboardingTab({
  clientId, detail, onChanged,
}: {
  clientId: string; detail: AdminClientDetail; onChanged: () => void
}) {
  const [stage, setStage] = useState<OnboardingStage>(detail.onboarding_stage)
  const [notes, setNotes] = useState(detail.onboarding_notes ?? '')
  const [err,   setErr]   = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  const current = ONBOARDING_STEPS.find((s) => s.value === stage) ?? ONBOARDING_STEPS[0]

  function save() {
    setErr(null)
    startSave(async () => {
      const result = await updateClientOnboarding(clientId, stage, notes)
      if (result.ok) onChanged()
      else setErr(result.error ?? 'Could not update onboarding.')
    })
  }

  return (
    <div className="flex flex-col gap-5">
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
        </div>
      </Section>

      <Section title="Onboarding Notes">
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
          placeholder="Internal onboarding notes…"
          className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white
                     placeholder-[#6a6a6e] resize-none focus:outline-none focus:border-[#ff7a18]/40 transition-all"
        />
      </Section>

      {err && <p className="text-[12px] text-[#ff8a7a]">{err}</p>}

      <button type="button" onClick={save} disabled={saving}
              className="self-start inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl
                         bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]
                         hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50">
        {saving ? 'Saving…' : 'Update onboarding stage'}
      </button>
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
