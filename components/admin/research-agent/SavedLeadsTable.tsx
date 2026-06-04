'use client'

// Saved Leads view for the Business Research Agent. Aggregates saved
// research_leads (is_saved=true, not archived) across all runs, de-duplicated
// server-side. Status actions only change the lead's status — nothing is sent.

import { Fragment, useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import type { SavedResearchLead } from '@/lib/data/admin-research'
import { ActionsToggle } from '@/components/admin/ui/ExpandableRow'
import LeadScoreBadge from './LeadScoreBadge'
import SavedLeadDetailPanel, {
  type LeadStatusAction, LEAD_STATUS_META, LEAD_STATUS_ORDER,
} from './SavedLeadDetailPanel'

function host(url: string | null): string | null {
  if (!url) return null
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
function fmtDate(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function StatusPill({ status }: { status: string }) {
  const m = LEAD_STATUS_META[status] ?? { label: status, color: '#6a6a6e' }
  return (
    <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
      style={{ color: m.color, borderColor: `${m.color}33`, background: `${m.color}12` }}>
      {m.label}
    </span>
  )
}

export default function SavedLeadsTable({ migrationNeeded }: { migrationNeeded: boolean }) {
  const [leads, setLeads]       = useState<SavedResearchLead[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<SavedResearchLead | null>(null)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [filter, setFilter]     = useState<string>('all')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/research-agent/leads/saved', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Could not load saved leads.')
        setLeads([])
      } else {
        setLeads((data.leads ?? []) as SavedResearchLead[])
      }
    } catch {
      setError('Could not reach the research service.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (migrationNeeded) { setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrationNeeded])

  async function setStatus(id: string, status: LeadStatusAction) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/research-agent/leads/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError((data?.error ?? 'Could not update status.') + (data?.detail ? ` — ${data.detail}` : ''))
        return
      }
      // Status-only update — the lead stays in the list and moves between
      // pipeline buckets (including Archived), reflected in the summary + filter.
      // Sending to Client Outreach is an explicit click in the detail modal
      // ("Open in Client Outreach"), never an automatic redirect here.
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
      setSelected((cur) => (cur?.id === id ? { ...cur, status } : cur))
    } catch {
      setError('Could not reach the research service.')
    } finally {
      setBusyId(null)
    }
  }

  if (migrationNeeded) {
    return (
      <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
        Saved leads are unavailable until migration{' '}
        <code className="font-mono text-[11.5px]">20260606120000_create_research_agent.sql</code> is applied in Supabase.
      </div>
    )
  }

  // Pipeline counts per status + the current filtered view.
  const counts: Record<string, number> = {}
  for (const s of LEAD_STATUS_ORDER) counts[s] = 0
  for (const l of leads) if (l.status in counts) counts[l.status] += 1
  const filtered = filter === 'all' ? leads : leads.filter((l) => l.status === filter)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-[#9a9a9d]">
          {loading
            ? 'Loading saved leads…'
            : filter === 'all'
              ? `${leads.length} saved lead${leads.length !== 1 ? 's' : ''} across all runs`
              : `${filtered.length} of ${leads.length} saved leads`}
        </p>
        <button type="button" onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                     bg-white/[0.04] border border-white/[0.1] text-[#cfd3dc]
                     hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
        </button>
      </div>

      {/* Pipeline summary + filter (compact, clickable) */}
      {!loading && leads.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <SummaryCard label="All" count={leads.length} color="#ff7a18"
            active={filter === 'all'} onClick={() => setFilter('all')} />
          {LEAD_STATUS_ORDER.map((s) => (
            <SummaryCard key={s} label={LEAD_STATUS_META[s].label} count={counts[s]} color={LEAD_STATUS_META[s].color}
              active={filter === s} onClick={() => setFilter(s)} />
          ))}
        </div>
      )}

      {error && <div className="text-[12px] text-[#ff8a7a]">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12 flex items-center justify-center gap-2 text-[13px] text-[#9a9a9d]">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-12 text-center flex flex-col items-center gap-2">
          <div className="text-[15px] font-medium text-white">No saved leads yet</div>
          <p className="text-[13px] text-[#9a9a9d] max-w-[440px]">
            Run research and click <span className="text-[#ffae3c]">Save</span> on a result, or enable
            “Save qualified leads automatically”. Saved leads from every run appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10 text-center text-[13px] text-[#9a9a9d]">
          No leads with status “{LEAD_STATUS_META[filter]?.label ?? filter}”.{' '}
          <button type="button" onClick={() => setFilter('all')} className="text-[#ffae3c] hover:underline">Show all</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[1000px]">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
                <tr>
                  <th className="text-left px-3 py-2.5 min-w-[160px]">Business</th>
                  <th className="text-left px-3 py-2.5">Niche</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Phone</th>
                  <th className="text-left px-3 py-2.5">Website</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Rating</th>
                  <th className="text-left px-3 py-2.5 min-w-[200px]">Problem Found</th>
                  <th className="text-left px-3 py-2.5">Score</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Saved</th>
                  <th className="text-right px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const web = host(l.website)
                  const isOpen = selected?.id === l.id
                  return (
                    <Fragment key={l.id}>
                      <tr className={`border-t border-white/[0.04] align-top transition-colors ${isOpen ? 'bg-[#ff7a18]/[0.04]' : 'hover:bg-white/[0.015]'}`}>
                        <td className="px-3 py-2.5">
                          <div className="text-white font-medium">{l.business_name}</div>
                          {l.address && <div className="text-[10.5px] text-[#6a6a6e] mt-0.5 max-w-[200px]">{l.address}</div>}
                          {l.google_maps_url && (
                            <a href={l.google_maps_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10.5px] text-[#6a6a6e] hover:text-[#ffae3c] mt-0.5 transition-colors">
                              Maps <ExternalLink size={9} />
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap">{l.niche ?? '—'}</td>
                        <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap">{l.phone ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          {web ? (
                            <a href={l.website!} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#9a9a9d] hover:text-[#ffae3c] break-all transition-colors">
                              {web.length > 26 ? web.slice(0, 26) + '…' : web} <ExternalLink size={9} className="shrink-0" />
                            </a>
                          ) : <span className="text-[#6a6a6e]">None</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-[#9a9a9d] tabular-nums">
                          {l.rating !== null ? <>{l.rating.toFixed(1)}★ <span className="text-[#6a6a6e]">({l.review_count ?? 0})</span></> : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-[#9a9a9d] max-w-[240px]">{l.problem_found ?? '—'}</td>
                        <td className="px-3 py-2.5">{l.lead_score !== null ? <LeadScoreBadge score={l.lead_score} /> : '—'}</td>
                        <td className="px-3 py-2.5"><StatusPill status={l.status} /></td>
                        <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap tabular-nums">{fmtDate(l.saved_at)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end">
                            <ActionsToggle open={isOpen} onToggle={() => setSelected(isOpen ? null : l)} label="View" />
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <SavedLeadDetailPanel
                              lead={l}
                              busy={busyId === l.id}
                              onClose={() => setSelected(null)}
                              onStatusChange={setStatus}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact, clickable pipeline summary card that doubles as the status filter.
function SummaryCard({
  label, count, color, active, onClick,
}: {
  label: string; count: number; color: string; active: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-xl border px-3 py-2.5 text-left transition-all"
      style={{
        borderColor: active ? color : 'rgba(255,255,255,0.07)',
        background:  active ? `${color}14` : 'rgba(255,255,255,0.02)',
      }}>
      <div className="text-[17px] font-bold tabular-nums leading-none" style={{ color }}>{count}</div>
      <div className="text-[10px] text-[#9a9a9d] uppercase tracking-[0.06em] mt-1 truncate">{label}</div>
    </button>
  )
}
