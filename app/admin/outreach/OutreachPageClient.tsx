'use client'

// Client Outreach Dashboard body. Compact lead tracker with expandable
// action panels (matches the audits/clients/launch tables), plus the daily
// plan, playbook, and end-of-day review. Every status change is manual.

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Activity } from 'lucide-react'
import type { AdminOutreachLead, OutreachDailyReview as Review } from '@/lib/data/admin-outreach'
import {
  STATUS_CONFIG, CONTACT_METHOD_LABELS, scoreBand, DAILY_PLAN, INACTIVE_STATUSES,
  OUTREACH_REPLY_STATUSES, TODAYS_OUTREACH_TARGET, type OutreachReplyStatus,
} from '@/lib/admin/outreach'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import { ExpandToggle, ActionsToggle } from '@/components/admin/ui/ExpandableRow'
import ExpandableActionPanel, { PanelActionButton, PanelSectionLabel } from '@/components/admin/ui/ExpandableActionPanel'
import CompactDataList, { type DataItem } from '@/components/admin/ui/CompactDataList'
import { setOutreachStatus, archiveOutreachLead, createAuditFromOutreachLead } from '@/lib/actions/admin-outreach'
import OutreachLeadModal from './OutreachLeadModal'
import OutreachPlaybook from './OutreachPlaybook'
import OutreachDailyReview from './OutreachDailyReview'

const COL_SPAN = 8
const today = () => new Date().toISOString().slice(0, 10)

function statusHint(s: OutreachReplyStatus, nextAction: string | null): string {
  if (nextAction) return nextAction
  switch (s) {
    case 'new':              return 'Send the first DM, then mark contacted.'
    case 'contacted':        return 'Wait for a reply, or follow up on the scheduled day.'
    case 'follow_up_needed': return 'Send the next follow-up message.'
    case 'replied':          return 'They replied — send a demo or book a call.'
    case 'demo_sent':        return 'Follow up on the demo and try to book a call.'
    case 'call_booked':      return 'Prep for the call and confirm the time.'
    case 'proposal_sent':    return 'Follow up on the proposal and close.'
    case 'won':              return 'Won — convert to a client and start onboarding.'
    case 'lost':             return 'Lost — consider moving to nurture for later.'
    case 'nurture':          return 'Check back later with a fresh angle.'
    default:                 return 'Review this lead and choose the next step.'
  }
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...OUTREACH_REPLY_STATUSES.filter((s) => s !== 'archived').map((s) => ({ value: s, label: STATUS_CONFIG[s].label })),
]

export default function OutreachPageClient({
  leads, initialReview, reviewDate, initialPrefill,
}: {
  leads:          AdminOutreachLead[]
  initialReview:  Review | null
  reviewDate:     string
  initialPrefill?: Partial<AdminOutreachLead> | null
}) {
  const router = useRouter()
  const [search, setSearch]       = useState('')
  const [statusF, setStatusF]     = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // A prefill (e.g. from the Research Agent) opens Add lead pre-populated.
  const [activePrefill, setActivePrefill] = useState<Partial<AdminOutreachLead> | null>(initialPrefill ?? null)
  const [modalOpen, setModalOpen] = useState(!!initialPrefill)
  const [editLead, setEditLead]   = useState<AdminOutreachLead | null>(null)

  function closeModal() {
    setModalOpen(false)
    setEditLead(null)
    // Drop the prefill + its query param so a refresh/return doesn't re-open.
    if (activePrefill) router.replace('/admin/outreach')
    setActivePrefill(null)
  }
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [archiving, startArchive] = useTransition()
  // Daily plan checklist — local only (a daily guide, not persisted).
  const [planDone, setPlanDone]   = useState<Record<string, boolean>>({})

  const t = today()

  // KPIs from the live (non-archived) set.
  const k = useMemo(() => {
    let contactedToday = 0, replies = 0, followUpsDue = 0, hotLeads = 0, callsBooked = 0
    for (const l of leads) {
      if ((l.last_contacted_at ?? '').slice(0, 10) === t) contactedToday++
      if (l.reply_status === 'replied') replies++
      if (l.reply_status === 'call_booked') callsBooked++
      const inactive = INACTIVE_STATUSES.includes(l.reply_status)
      if (l.follow_up_date && l.follow_up_date <= t && !inactive) followUpsDue++
      if (l.score >= 8 && !inactive) hotLeads++
    }
    return { contactedToday, replies, followUpsDue, hotLeads, callsBooked }
  }, [leads, t])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (statusF !== 'all' && l.reply_status !== statusF) return false
      if (!q) return true
      return (
        l.business_name.toLowerCase().includes(q) ||
        l.niche.toLowerCase().includes(q) ||
        (l.location ?? '').toLowerCase().includes(q) ||
        (l.next_action ?? '').toLowerCase().includes(q)
      )
    })
  }, [leads, search, statusF])

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id))
  }

  function confirmArchive() {
    if (!archiveId) return
    const id = archiveId
    startArchive(async () => {
      const r = await archiveOutreachLead(id)
      if (r.ok) { setArchiveId(null); router.refresh() }
      else { alert(r.error ?? 'Could not archive lead.'); setArchiveId(null) }
    })
  }

  return (
    <>
      {/* KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <AdminKpiCard label="Today's Target"  value={TODAYS_OUTREACH_TARGET} tone="orange"  sublabel="Businesses to contact" />
        <AdminKpiCard label="Contacted Today" value={k.contactedToday}       tone={k.contactedToday > 0 ? 'success' : 'neutral'} sublabel={`Goal: ${TODAYS_OUTREACH_TARGET}`} />
        <AdminKpiCard label="Replies"         value={k.replies}              tone={k.replies > 0 ? 'info' : 'neutral'}    sublabel="Awaiting handling" />
        <AdminKpiCard label="Follow-Ups Due"  value={k.followUpsDue}         tone={k.followUpsDue > 0 ? 'warning' : 'neutral'} sublabel="Today or overdue" />
        <AdminKpiCard label="Hot Leads"       value={k.hotLeads}             tone={k.hotLeads > 0 ? 'success' : 'neutral'} sublabel="Score 8+" />
        <AdminKpiCard label="Calls Booked"    value={k.callsBooked}          tone={k.callsBooked > 0 ? 'success' : 'neutral'} sublabel="Discovery calls" />
      </section>

      {/* Tracker (2/3) + Daily Plan (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] pointer-events-none" />
              <input type="text" placeholder="Search business, niche, location…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all" />
            </div>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
              className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012] text-[13px] text-white cursor-pointer focus:outline-none focus:border-[#ff7a18]/40 transition-all">
              {STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" onClick={() => { setEditLead(null); setActivePrefill(null); setModalOpen(true) }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white transition-all shrink-0">
              <Plus size={14} /> Add lead
            </button>
          </div>

          {/* Table */}
          {leads.length === 0 ? (
            <Empty title="No outreach leads yet" body="Add your first prospect to start tracking outreach. Use the playbook below for scripts and follow-ups." />
          ) : filtered.length === 0 ? (
            <Empty title="No matches" body="No leads match the current search or filter." />
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] min-w-[640px]">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                    <tr>
                      <th className="px-2 py-2.5 w-[28px]" aria-label="Expand" />
                      <th className="text-left px-3 py-2.5 min-w-[150px]">Business</th>
                      <th className="text-left px-3 py-2.5">Niche</th>
                      <th className="text-left px-3 py-2.5">Score</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5 whitespace-nowrap">Follow-Up</th>
                      <th className="text-left px-3 py-2.5 min-w-[140px]">Next Action</th>
                      <th className="text-right px-3 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => {
                      const isOpen = expandedId === l.id
                      const cfg = STATUS_CONFIG[l.reply_status]
                      const band = scoreBand(l.score)
                      const overdue = !!l.follow_up_date && l.follow_up_date <= t && !INACTIVE_STATUSES.includes(l.reply_status)

                      const details: DataItem[] = [
                        { label: 'Location', value: l.location ?? '—' },
                        { label: 'Contact method', value: CONTACT_METHOD_LABELS[l.contact_method] },
                        { label: 'Instagram', value: l.instagram_url
                          ? <a href={l.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[#9a9a9d] hover:text-[#ffae3c] break-all">{l.instagram_url.replace(/^https?:\/\//, '')}</a> : '—' },
                        { label: 'Website', value: l.website_url
                          ? <a href={l.website_url} target="_blank" rel="noopener noreferrer" className="text-[#9a9a9d] hover:text-[#ffae3c] break-all">{l.website_url.replace(/^https?:\/\//, '')}</a> : '—' },
                        { label: 'Phone', value: l.phone ?? '—' },
                        { label: 'Email', value: l.email ?? '—' },
                        { label: 'Last contacted', value: l.last_contacted_at ? new Date(l.last_contacted_at).toLocaleString() : 'Not yet' },
                        { label: 'Added by', value: l.created_by_name ?? l.created_by_email ?? 'Unknown' },
                        { label: 'Added', value: new Date(l.created_at).toLocaleDateString() },
                        { label: 'Source', value: (l.notes ?? '').includes('From Research Agent') ? 'Research Agent' : 'Manual' },
                        { label: 'Pain found', value: l.pain_found ?? '—', full: true },
                        { label: 'Outreach angle', value: l.outreach_angle ?? '—', full: true },
                        { label: 'Notes', value: l.notes ?? '—', full: true },
                      ]

                      return (
                        <Fragment key={l.id}>
                          <tr className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.015]">
                            <td className="px-2 py-2.5">
                              <ExpandToggle open={isOpen} onToggle={() => toggleExpand(l.id)} label={`Toggle details for ${l.business_name}`} />
                            </td>
                            <td className="px-3 py-2.5">
                              <button type="button" onClick={() => toggleExpand(l.id)}
                                className="text-white font-medium hover:text-[#ffae3c] transition-colors text-left focus:outline-none focus:underline">
                                {l.business_name}
                              </button>
                              {l.location && <div className="text-[10.5px] text-[#6a6a6e] mt-0.5 truncate max-w-[180px]">{l.location}</div>}
                            </td>
                            <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap">{l.niche}</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tabular-nums" style={{ color: band.color }}>
                                {l.score}<span className="text-[9.5px] font-normal text-[#6a6a6e]">/10</span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                                style={{ color: cfg.color, borderColor: `${cfg.color}33`, background: `${cfg.color}12` }}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-[11.5px] tabular-nums" style={{ color: overdue ? '#ff5247' : '#9a9a9d' }}>
                              {l.follow_up_date ? new Date(l.follow_up_date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-[#9a9a9d] max-w-[180px] truncate">{l.next_action ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex justify-end">
                                <ActionsToggle open={isOpen} onToggle={() => toggleExpand(l.id)} label={isOpen ? 'Close' : 'Actions'} />
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={COL_SPAN} className="p-0">
                              <ExpandableActionPanel
                                open={isOpen}
                                title="Recommended next action"
                                description={statusHint(l.reply_status, l.next_action)}
                                meta={
                                  <>
                                    <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                                      style={{ color: cfg.color, borderColor: `${cfg.color}33`, background: `${cfg.color}12` }}>{cfg.label}</span>
                                    <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                                      style={{ color: band.color, borderColor: `${band.color}33`, background: `${band.color}12` }}>{l.score}/10 · {band.label}</span>
                                    <span className="text-[11px] text-[#9a9a9d]">{CONTACT_METHOD_LABELS[l.contact_method]}</span>
                                  </>
                                }
                                actions={
                                  <OutreachRowActions
                                    lead={l}
                                    onChanged={() => router.refresh()}
                                    onEdit={() => { setEditLead(l); setActivePrefill(null); setModalOpen(true) }}
                                    onArchive={() => setArchiveId(l.id)}
                                  />
                                }
                              >
                                <CompactDataList items={details} />
                              </ExpandableActionPanel>
                            </td>
                          </tr>
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Daily Outreach Plan */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-[#ff7a18]/10">
              <Activity size={13} className="text-[#ff7a18]" />
              <h2 className="text-[13.5px] font-semibold text-white">Daily Outreach Plan</h2>
            </header>
            <div className="px-5 py-3.5 flex flex-col gap-2">
              {DAILY_PLAN.map((item) => (
                <button key={item} type="button" onClick={() => setPlanDone((p) => ({ ...p, [item]: !p[item] }))}
                  className="flex items-start gap-2.5 text-left">
                  <span className={`mt-[1px] w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center transition-colors ${
                    planDone[item] ? 'bg-[#ff7a18]/20 border-[#ff7a18]/50 text-[#ffae3c]' : 'border-white/[0.15] text-transparent'
                  }`}>
                    <CheckMark />
                  </span>
                  <span className={`text-[12.5px] leading-snug ${planDone[item] ? 'text-[#cfd3dc] line-through' : 'text-[#cfd3dc]'}`}>{item}</span>
                </button>
              ))}
              <p className="text-[10.5px] text-[#6a6a6e] mt-1 border-t border-white/[0.06] pt-2.5">
                A daily guide — checkmarks reset each visit. Lead data is saved.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* Playbook + End-of-day review */}
      <OutreachPlaybook />
      <OutreachDailyReview initialReview={initialReview} reviewDate={reviewDate} />

      {/* Add / edit modal */}
      {modalOpen && (
        <OutreachLeadModal
          lead={editLead}
          prefill={editLead ? null : activePrefill}
          onClose={closeModal}
          onSaved={() => { closeModal(); router.refresh() }}
        />
      )}

      {/* Archive confirm */}
      <ConfirmActionDialog
        open={!!archiveId}
        title="Archive this lead?"
        body="This hides the lead from the tracker. The record is kept (soft archive) — nothing is deleted."
        confirmLabel="Archive lead"
        loading={archiving}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveId(null)}
      />
    </>
  )
}

// ── Per-row action buttons (own transition; manual status changes) ──
function OutreachRowActions({
  lead, onChanged, onEdit, onArchive,
}: {
  lead: AdminOutreachLead
  onChanged: () => void
  onEdit: () => void
  onArchive: () => void
}) {
  const [pending, start] = useTransition()
  const s = lead.reply_status

  function mark(status: OutreachReplyStatus) {
    start(async () => {
      const r = await setOutreachStatus(lead.id, status)
      if (r.ok) onChanged()
      else alert(r.error ?? 'Could not update status.')
    })
  }
  function createAudit() {
    start(async () => {
      const r = await createAuditFromOutreachLead(lead.id)
      if (r.ok) { alert('Audit created — review it in Audits.'); onChanged() }
      else alert(r.error ?? 'Could not create audit.')
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        {s !== 'contacted'   && <PanelActionButton variant="primary"   disabled={pending} onClick={() => mark('contacted')}>Mark contacted</PanelActionButton>}
        {s !== 'replied'     && <PanelActionButton variant="info"      disabled={pending} onClick={() => mark('replied')}>Mark replied</PanelActionButton>}
        {s !== 'demo_sent'   && <PanelActionButton variant="info"      disabled={pending} onClick={() => mark('demo_sent')}>Mark demo sent</PanelActionButton>}
        {s !== 'call_booked' && <PanelActionButton variant="success"   disabled={pending} onClick={() => mark('call_booked')}>Mark call booked</PanelActionButton>}
        {s !== 'won'         && <PanelActionButton variant="success"   disabled={pending} onClick={() => mark('won')}>Mark won</PanelActionButton>}
        {s !== 'lost'        && <PanelActionButton variant="danger"    disabled={pending} onClick={() => mark('lost')}>Mark lost</PanelActionButton>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <PanelSectionLabel>Manage</PanelSectionLabel>
        <PanelActionButton variant="secondary" disabled={pending} onClick={onEdit}>Edit lead</PanelActionButton>
        <PanelActionButton variant="secondary" disabled={pending} onClick={createAudit}>Create Audit From Lead</PanelActionButton>
        <PanelActionButton variant="danger"    disabled={pending} onClick={onArchive}>Archive</PanelActionButton>
      </div>
    </div>
  )
}

function CheckMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 12 5 5 11-12" />
    </svg>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12 text-center flex flex-col items-center gap-2">
      <div className="text-[15px] font-medium text-white">{title}</div>
      <p className="text-[13px] text-[#9a9a9d] max-w-[420px]">{body}</p>
    </div>
  )
}
