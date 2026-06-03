'use client'

// Reusable detail drawer for a saved research lead. Right-side drawer on
// desktop, full-width sheet on small screens. Scrollable body with the status
// actions pinned to the bottom. Copy buttons help manual outreach — nothing is
// ever sent automatically; status actions only change the lead's status.

import { useEffect, useRef, useState } from 'react'
import {
  X, Copy, Check, AlertTriangle, ExternalLink, Megaphone, Phone, Archive, Loader2,
  ThumbsUp, ThumbsDown, CalendarCheck,
} from 'lucide-react'
import type { SavedResearchLead } from '@/lib/data/admin-research'
import LeadScoreBadge from './LeadScoreBadge'

// The manual-outreach pipeline statuses a founder can set from the UI.
export type LeadStatusAction =
  | 'ready_for_outreach' | 'contacted' | 'interested'
  | 'call_booked' | 'not_interested' | 'archived'

// Single source of truth for status labels + colors (shared with the table).
export const LEAD_STATUS_META: Record<string, { label: string; color: string }> = {
  saved:              { label: 'Saved',              color: '#6db4ff' },
  ready_for_outreach: { label: 'Ready for Outreach', color: '#ffae3c' },
  contacted:          { label: 'Contacted',          color: '#22d093' },
  interested:         { label: 'Interested',         color: '#3b9eff' },
  call_booked:        { label: 'Call Booked',        color: '#22d093' },
  not_interested:     { label: 'Not Interested',     color: '#ff8a7a' },
  archived:           { label: 'Archived',           color: '#6a6a6e' },
  found:              { label: 'Found',               color: '#6a6a6e' },
}

// Pipeline display order for summary cards + filters.
export const LEAD_STATUS_ORDER = [
  'saved', 'ready_for_outreach', 'contacted', 'interested',
  'call_booked', 'not_interested', 'archived',
] as const

// Statuses that mean outreach has already happened.
const CONTACTED_STATUSES = ['contacted', 'interested', 'call_booked', 'not_interested']

function fmtDateTime(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}
function host(url: string | null): string | null {
  if (!url) return null
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

interface Props {
  lead:           SavedResearchLead
  busy:           boolean
  onClose:        () => void
  onStatusChange: (id: string, status: LeadStatusAction) => void
}

export default function SavedLeadDetailPanel({ lead, busy, onClose, onStatusChange }: Props) {
  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const status = LEAD_STATUS_META[lead.status] ?? { label: lead.status, color: '#6a6a6e' }
  const alreadyContacted = CONTACTED_STATUSES.includes(lead.status)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer (full-width sheet on mobile, right drawer on desktop) */}
      <aside className="relative h-full w-full sm:max-w-[460px] bg-[#0c0d0f] border-l border-white/[0.08] flex flex-col shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-white leading-tight break-words">{lead.business_name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[12px] text-[#9a9a9d]">{lead.niche ?? '—'}</span>
              <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                style={{ color: status.color, borderColor: `${status.color}33`, background: `${status.color}12` }}>
                {status.label}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center
                       text-[#9a9a9d] hover:text-white hover:bg-white/[0.08] transition-all shrink-0">
            <X size={15} />
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Business */}
          <Section title="Business">
            <InfoRow label="Niche"   value={lead.niche} />
            <InfoRow label="Rating"  value={lead.rating !== null ? `${lead.rating.toFixed(1)}★ (${lead.review_count ?? 0} reviews)` : null} />
            <InfoRow label="Created" value={fmtDateTime(lead.created_at)} />
            <InfoRow label="Saved"   value={fmtDateTime(lead.saved_at)} />
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <ContactRow label="Phone"           value={lead.phone} copyable />
            <ContactRow label="Website"         value={host(lead.website)} href={lead.website} copyValue={lead.website} copyable />
            <ContactRow label="Google Maps URL" value={lead.google_maps_url} href={lead.google_maps_url} copyValue={lead.google_maps_url} copyable />
            <ContactRow label="Address"         value={lead.address} />
          </Section>

          {/* Lead Score */}
          <Section title="Lead Score">
            <div className="px-3.5 py-3 flex items-center gap-2">
              {lead.lead_score !== null
                ? <LeadScoreBadge score={lead.lead_score} showLabel />
                : <span className="text-[12.5px] text-[#6a6a6e]">Not scored</span>}
            </div>
          </Section>

          {/* Problem Found */}
          <Section title="Problem Found">
            <TextBlock value={lead.problem_found} />
          </Section>

          {/* Outreach Material */}
          <Section title="Outreach Material">
            <TextBlock label="Outreach Angle"       value={lead.outreach_angle} copyable />
            <TextBlock label="Recommended First DM" value={lead.first_dm} copyable />
            <TextBlock label="Cold Email Opening"   value={lead.cold_email_opening} copyable />
          </Section>

          {/* Notes / Next Action */}
          <Section title="Notes / Next Action">
            <div className="px-3.5 py-3 text-[12px] text-[#9a9a9d] leading-relaxed">
              Research leads don&apos;t store notes. Use{' '}
              <span className="text-[#ffae3c]">Ready for Outreach</span> to send this business to Client
              Outreach, where you can track next actions and notes.
            </div>
          </Section>
        </div>

        {/* Pinned actions */}
        <footer className="shrink-0 border-t border-white/[0.06] px-5 py-3.5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6a6a6e]">Actions</span>
            {busy && <Loader2 size={13} className="animate-spin text-[#6a6a6e]" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!alreadyContacted ? (
              <>
                <ActionBtn onClick={() => onStatusChange(lead.id, 'contacted')} disabled={busy} tone="red" icon={<Phone size={12} />}>
                  Contact
                </ActionBtn>
                <ActionBtn onClick={() => onStatusChange(lead.id, 'ready_for_outreach')} disabled={busy} tone="orange" icon={<Megaphone size={12} />}>
                  Ready for Outreach
                </ActionBtn>
                <ActionBtn onClick={() => onStatusChange(lead.id, 'archived')} disabled={busy} tone="neutral" icon={<Archive size={12} />}>
                  Archive
                </ActionBtn>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium border
                                 border-[#22d093]/35 bg-[#22d093]/[0.12] text-[#22d093]">
                  <Check size={12} /> Contacted
                </span>
                <ActionBtn onClick={() => onStatusChange(lead.id, 'interested')} disabled={busy} tone="blue" icon={<ThumbsUp size={12} />}>
                  Interested
                </ActionBtn>
                <ActionBtn onClick={() => onStatusChange(lead.id, 'call_booked')} disabled={busy} tone="green" icon={<CalendarCheck size={12} />}>
                  Call Booked
                </ActionBtn>
                <ActionBtn onClick={() => onStatusChange(lead.id, 'not_interested')} disabled={busy} tone="red" icon={<ThumbsDown size={12} />}>
                  Not Interested
                </ActionBtn>
                <ActionBtn onClick={() => onStatusChange(lead.id, 'archived')} disabled={busy} tone="neutral" icon={<Archive size={12} />}>
                  Archive
                </ActionBtn>
              </>
            )}
          </div>
        </footer>
      </aside>
    </div>
  )
}

// ── Sections ──────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6a6a6e]">{title}</h3>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.05]">
        {children}
      </div>
    </section>
  )
}

// A simple single-line label/value row (no copy).
function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6a6a6e]">{label}</div>
      <div className="text-[12.5px] text-[#cfd3dc] text-right break-words min-w-0">{value ?? '—'}</div>
    </div>
  )
}

// A single-line field with an optional link + copy button.
function ContactRow({
  label, value, href, copyValue, copyable,
}: {
  label: string; value: string | null; href?: string | null; copyValue?: string | null; copyable?: boolean
}) {
  const text = copyValue ?? value
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6a6a6e]">{label}</div>
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-[12.5px] text-[#9a9a9d] hover:text-[#ffae3c] break-all transition-colors inline-flex items-center gap-1">
              {value} <ExternalLink size={10} className="shrink-0" />
            </a>
          ) : (
            <div className="text-[12.5px] text-[#cfd3dc] break-words">{value}</div>
          )
        ) : (
          <div className="text-[12.5px] text-[#6a6a6e]">—</div>
        )}
      </div>
      {copyable && text && <CopyButton value={text} />}
    </div>
  )
}

// A multi-line text block, optionally with a copy button in the header.
function TextBlock({ label, value, copyable }: { label?: string; value: string | null; copyable?: boolean }) {
  return (
    <div className="px-3.5 py-3">
      {(label || copyable) && (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          {label && <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6a6a6e]">{label}</div>}
          {copyable && value && <CopyButton value={value} />}
        </div>
      )}
      <div className="text-[12.5px] text-[#cfd3dc] whitespace-pre-wrap break-words leading-relaxed">
        {value ?? '—'}
      </div>
    </div>
  )
}

// ── Copy button (clipboard with success / failure state) ──────────
function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setState('ok')
    } catch {
      setState('err')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1800)
  }

  const tone =
    state === 'ok'  ? 'border-[#22d093]/40 text-[#22d093] bg-[#22d093]/[0.12]'
    : state === 'err' ? 'border-[#ff5247]/40 text-[#ff8a7a] bg-[#ff5247]/[0.12]'
    : 'border-white/[0.1] text-[#9a9a9d] bg-white/[0.04] hover:text-white hover:bg-white/[0.08]'

  return (
    <button type="button" onClick={copy} aria-label="Copy"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all shrink-0 ${tone}`}>
      {state === 'ok' ? <Check size={12} /> : state === 'err' ? <AlertTriangle size={12} /> : <Copy size={12} />}
      {state === 'ok' ? 'Copied' : state === 'err' ? 'Failed' : 'Copy'}
    </button>
  )
}

// ── Status action button ──────────────────────────────────────────
function ActionBtn({
  children, onClick, disabled, tone, icon,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean
  tone: 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'neutral'; icon: React.ReactNode
}) {
  const tones = {
    orange:  'bg-[#ff7a18]/[0.12] border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white',
    green:   'bg-[#22d093]/[0.12] border-[#22d093]/35 text-[#22d093] hover:bg-[#22d093]/20 hover:text-white',
    blue:    'bg-[#3b9eff]/[0.12] border-[#3b9eff]/35 text-[#3b9eff] hover:bg-[#3b9eff]/20 hover:text-white',
    purple:  'bg-[#a07cff]/[0.12] border-[#a07cff]/35 text-[#a07cff] hover:bg-[#a07cff]/20 hover:text-white',
    red:     'bg-[#ff5247]/[0.12] border-[#ff5247]/35 text-[#ff8a7a] hover:bg-[#ff5247]/20 hover:text-white',
    neutral: 'bg-white/[0.04] border-white/[0.1] text-[#cfd3dc] hover:bg-white/[0.08] hover:text-white',
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tones[tone]}`}>
      {icon} {children}
    </button>
  )
}
