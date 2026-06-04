'use client'

// Inline detail card for a saved research lead — unfolds beneath its table
// row (same style as the Client Outreach expanded detail). Reversible status
// chips, copy buttons, and a safe Client Outreach handoff. Nothing is sent;
// status actions only change the lead's status field.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, RotateCcw, Archive, ArrowRight, Loader2 } from 'lucide-react'
import type { SavedResearchLead } from '@/lib/data/admin-research'
import ExpandableActionPanel, { PanelActionButton } from '@/components/admin/ui/ExpandableActionPanel'
import CompactDataList, { type DataItem } from '@/components/admin/ui/CompactDataList'
import LeadScoreBadge from './LeadScoreBadge'
import { CopyButton } from './AgentCard'

// The manual-outreach pipeline statuses a founder can set from the UI.
export type LeadStatusAction =
  | 'saved' | 'ready_for_outreach' | 'contacted' | 'interested'
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

// Pipeline display order for summary cards + filters + the status selector.
export const LEAD_STATUS_ORDER = [
  'saved', 'ready_for_outreach', 'contacted', 'interested',
  'call_booked', 'not_interested', 'archived',
] as const

const NEXT_ACTION: Record<string, string> = {
  saved:              'Review this lead, then mark Ready for Outreach when you’re set to reach out.',
  ready_for_outreach: 'Open in Client Outreach to start, then mark Contacted once you’ve reached out.',
  contacted:          'Awaiting a reply — send a follow-up if you don’t hear back.',
  interested:         'They’re interested — move toward booking a call.',
  call_booked:        'Prep for the call and confirm the time.',
  not_interested:     'Not interested — archive, or revisit later.',
  archived:           'Archived. Change the status to bring it back into the pipeline.',
}

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
  const router = useRouter()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const status = LEAD_STATUS_META[lead.status] ?? { label: lead.status, color: '#6a6a6e' }

  function pick(next: LeadStatusAction) {
    if (busy || next === lead.status) return
    if (next === 'archived') { setConfirmArchive(true); return }
    onStatusChange(lead.id, next)
  }
  function doArchive() {
    setConfirmArchive(false)
    onStatusChange(lead.id, 'archived')
    onClose() // archived leads drop out of the active view
  }

  const items: DataItem[] = [
    { label: 'Business', value: lead.business_name },
    { label: 'Niche',    value: lead.niche ?? '—' },
    { label: 'Status',   value: status.label },
    { label: 'Address',  value: lead.address ?? '—' },
    { label: 'Phone',    value: <CopyValue value={lead.phone} /> },
    { label: 'Website',  value: <CopyLink href={lead.website} text={host(lead.website)} copyValue={lead.website} /> },
    { label: 'Google Maps URL', value: <CopyLink href={lead.google_maps_url} text={lead.google_maps_url} copyValue={lead.google_maps_url} />, full: true },
    { label: 'Rating',     value: lead.rating !== null ? `${lead.rating.toFixed(1)}★ (${lead.review_count ?? 0} reviews)` : '—' },
    { label: 'Lead Score', value: lead.lead_score !== null ? `${lead.lead_score}/100` : '—' },
    { label: 'Created',    value: fmtDateTime(lead.created_at) },
    { label: 'Saved',      value: fmtDateTime(lead.saved_at) },
    { label: 'Problem Found',        value: lead.problem_found ?? '—', full: true },
    { label: 'Outreach Angle',       value: <CopyValue value={lead.outreach_angle} />, full: true },
    { label: 'Recommended First DM', value: <CopyValue value={lead.first_dm} />, full: true },
    { label: 'Cold Email Opening',   value: <CopyValue value={lead.cold_email_opening} />, full: true },
    { label: 'Notes / Next Action',  value: 'Research leads don’t store notes. Set Ready for Outreach, then use Open in Client Outreach to track next actions there.', full: true },
  ]

  return (
    <ExpandableActionPanel
      open
      title="Recommended Next Action"
      description={NEXT_ACTION[lead.status] ?? 'Review this lead and choose the next step.'}
      meta={
        <>
          <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
            style={{ color: status.color, borderColor: `${status.color}33`, background: `${status.color}12` }}>
            {status.label}
          </span>
          {lead.lead_score !== null && <LeadScoreBadge score={lead.lead_score} showLabel />}
          {lead.rating !== null && (
            <span className="text-[11px] text-[#9a9a9d] tabular-nums">{lead.rating.toFixed(1)}★ ({lead.review_count ?? 0})</span>
          )}
        </>
      }
      actions={
        <div className="flex flex-col gap-2.5 w-full">
          {/* Reversible status selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6a6a6e] mr-0.5">Status</span>
            {LEAD_STATUS_ORDER.map((s) => (
              <StatusChip key={s} meta={LEAD_STATUS_META[s]} active={lead.status === s} disabled={busy} onClick={() => pick(s)} />
            ))}
            {busy && <Loader2 size={13} className="animate-spin text-[#6a6a6e]" />}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <PanelActionButton variant="secondary" disabled={busy || lead.status === 'saved'} onClick={() => pick('saved')}>
              <RotateCcw size={12} /> Reset to Saved
            </PanelActionButton>
            <PanelActionButton variant="secondary" disabled={busy} onClick={() => setConfirmArchive(true)}>
              <Archive size={12} /> Archive Lead
            </PanelActionButton>
            {lead.status === 'ready_for_outreach' && (
              <PanelActionButton variant="primary" disabled={busy}
                onClick={() => router.push(`/admin/outreach?prefillResearchLeadId=${lead.id}`)}>
                Open in Client Outreach <ArrowRight size={12} />
              </PanelActionButton>
            )}
            <PanelActionButton variant="secondary" onClick={onClose}>Close</PanelActionButton>
          </div>

          {/* Archive confirmation */}
          {confirmArchive && (
            <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-3 flex flex-col gap-2.5">
              <p className="text-[12.5px] text-[#cfd3dc]">Archive this lead? You can still view it under Archived.</p>
              <div className="flex items-center gap-2">
                <PanelActionButton variant="danger" disabled={busy} onClick={doArchive}>
                  <Archive size={12} /> Archive lead
                </PanelActionButton>
                <PanelActionButton variant="secondary" disabled={busy} onClick={() => setConfirmArchive(false)}>
                  Cancel
                </PanelActionButton>
              </div>
            </div>
          )}
        </div>
      }
    >
      <CompactDataList items={items} />
    </ExpandableActionPanel>
  )
}

// ── Status chip (reversible; current one is highlighted) ──────────
function StatusChip({
  meta, active, disabled, onClick,
}: {
  meta: { label: string; color: string }; active: boolean; disabled?: boolean; onClick: () => void
}) {
  if (active) {
    return (
      <button type="button" onClick={onClick} disabled={disabled}
        className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all disabled:opacity-60"
        style={{ color: meta.color, borderColor: meta.color, background: `${meta.color}22` }}>
        {meta.label}
      </button>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full border
                 border-white/[0.1] bg-white/[0.03] text-[#9a9a9d] hover:bg-white/[0.07] hover:text-white
                 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
      {meta.label}
    </button>
  )
}

// ── Value renderers with copy buttons ─────────────────────────────
function CopyValue({ value }: { value: string | null }) {
  if (!value) return <span className="text-[#6a6a6e]">—</span>
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="whitespace-pre-wrap break-words">{value}</span>
      <CopyButton value={value} />
    </div>
  )
}

function CopyLink({ href, text, copyValue }: { href: string | null; text: string | null; copyValue: string | null }) {
  if (!text || !href) return <span className="text-[#6a6a6e]">—</span>
  return (
    <div className="flex items-center justify-between gap-2">
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-[#9a9a9d] hover:text-[#ffae3c] break-all inline-flex items-center gap-1 transition-colors">
        {text} <ExternalLink size={10} className="shrink-0" />
      </a>
      {copyValue && <CopyButton value={copyValue} />}
    </div>
  )
}
