'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Check, Loader2, Save } from 'lucide-react'
import type { ScoredLead } from '@/lib/research/leadScoring'
import { QUALIFIED_SCORE } from '@/lib/research/leadScoring'
import LeadScoreBadge from './LeadScoreBadge'

// A scored result as returned by /api/research-agent/run.
export interface ResearchResultLead extends ScoredLead {
  id:    string
  saved: boolean
}

interface Props {
  leads: ResearchResultLead[]
  runId: string | null
}

function host(url: string | null): string | null {
  if (!url) return null
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export default function ResearchResultsTable({ leads, runId }: Props) {
  // Track saved + in-flight state per row locally so buttons reflect reality.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savingAll, setSavingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // Re-seed saved state whenever a new result set arrives (auto-saved rows).
  useEffect(() => {
    setSavedIds(new Set(leads.filter((l) => l.saved).map((l) => l.id)))
    setSavingIds(new Set())
    setError(null)
    setNote(null)
  }, [leads])

  function toPayload(l: ResearchResultLead) {
    return {
      placeId: l.placeId, name: l.name, niche: l.niche, address: l.address, phone: l.phone,
      website: l.website, googleMapsUrl: l.googleMapsUrl, rating: l.rating,
      reviewCount: l.reviewCount, problemFound: l.problemFound, outreachAngle: l.outreachAngle,
      firstDm: l.firstDm, coldEmailOpening: l.coldEmailOpening, leadScore: l.leadScore,
    }
  }

  interface SaveResult { savedCount: number; duplicateCount: number; message: string }

  async function save(rows: ResearchResultLead[]): Promise<SaveResult | null> {
    if (rows.length === 0) return null
    setError(null)
    // Results live in the run's raw_results until saved — saving inserts them.
    const res = await fetch('/api/research-agent/leads/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, leads: rows.map(toPayload) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) {
      setError((data?.error ?? 'Could not save leads.') + (data?.detail ? ` — ${data.detail}` : ''))
      return null
    }
    // Duplicates are not errors — the rows are in the DB either way, so mark
    // them saved so the buttons reflect reality.
    setSavedIds((prev) => { const next = new Set(prev); for (const r of rows) next.add(r.id); return next })
    return {
      savedCount:     typeof data.savedCount === 'number' ? data.savedCount : rows.length,
      duplicateCount: typeof data.duplicateCount === 'number' ? data.duplicateCount : 0,
      message:        typeof data.message === 'string' ? data.message : 'Saved',
    }
  }

  async function saveOne(lead: ResearchResultLead) {
    setSavingIds((prev) => new Set(prev).add(lead.id))
    const r = await save([lead])
    if (r) setNote(r.savedCount === 0 && r.duplicateCount > 0 ? `“${lead.name}” was already saved.` : r.message)
    setSavingIds((prev) => { const next = new Set(prev); next.delete(lead.id); return next })
  }

  async function saveAllQualified() {
    const pending = leads.filter((l) => l.leadScore >= QUALIFIED_SCORE && !savedIds.has(l.id))
    if (pending.length === 0) return
    setSavingAll(true)
    const r = await save(pending)
    if (r) setNote(r.message)
    setSavingAll(false)
  }

  const qualifiedPending = leads.filter((l) => l.leadScore >= QUALIFIED_SCORE && !savedIds.has(l.id)).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-[#9a9a9d]">
          {leads.length} result{leads.length !== 1 ? 's' : ''} ·{' '}
          {leads.filter((l) => l.leadScore >= QUALIFIED_SCORE).length} qualified (score {QUALIFIED_SCORE}+)
        </p>
        <button type="button" onClick={saveAllQualified} disabled={savingAll || qualifiedPending === 0}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-medium
                     bg-[#22d093]/[0.12] border border-[#22d093]/35 text-[#22d093]
                     hover:bg-[#22d093]/20 hover:text-white transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
          {savingAll ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save all qualified{qualifiedPending > 0 ? ` (${qualifiedPending})` : ''}
        </button>
      </div>

      {error && <div className="text-[12px] text-[#ff8a7a]">{error}</div>}
      {note && !error && <div className="text-[12px] text-[#22d093]">{note}</div>}

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[920px]">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.08em] text-[#6a6a6e]">
              <tr>
                <th className="text-left px-3 py-2.5 min-w-[150px]">Business</th>
                <th className="text-left px-3 py-2.5">Category</th>
                <th className="text-left px-3 py-2.5">Website</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Phone</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Rating</th>
                <th className="text-left px-3 py-2.5 min-w-[200px]">Problem Found</th>
                <th className="text-left px-3 py-2.5 min-w-[200px]">Outreach Angle</th>
                <th className="text-left px-3 py-2.5">Score</th>
                <th className="text-left px-3 py-2.5 whitespace-nowrap">Status</th>
                <th className="text-right px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const isSaved  = savedIds.has(l.id)
                const isSaving = savingIds.has(l.id)
                const web = host(l.website)
                return (
                  <tr key={l.id} className="border-t border-white/[0.04] align-top hover:bg-white/[0.015] transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="text-white font-medium">{l.name}</div>
                      {l.address && <div className="text-[10.5px] text-[#6a6a6e] mt-0.5 max-w-[200px]">{l.address}</div>}
                      {l.googleMapsUrl && (
                        <a href={l.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10.5px] text-[#6a6a6e] hover:text-[#ffae3c] mt-0.5 transition-colors">
                          Maps <ExternalLink size={9} />
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap">{l.category ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {web ? (
                        <a href={l.website!} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#9a9a9d] hover:text-[#ffae3c] break-all transition-colors">
                          {web.length > 28 ? web.slice(0, 28) + '…' : web} <ExternalLink size={9} className="shrink-0" />
                        </a>
                      ) : <span className="text-[#6a6a6e]">None</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[#9a9a9d] whitespace-nowrap">{l.phone ?? '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#9a9a9d] tabular-nums">
                      {l.rating !== null ? <>{l.rating.toFixed(1)}★ <span className="text-[#6a6a6e]">({l.reviewCount ?? 0})</span></> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#9a9a9d] max-w-[240px]">{l.problemFound}</td>
                    <td className="px-3 py-2.5 text-[#9a9a9d] max-w-[240px]">{l.outreachAngle}</td>
                    <td className="px-3 py-2.5"><LeadScoreBadge score={l.leadScore} /></td>
                    <td className="px-3 py-2.5">
                      {isSaved ? (
                        <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                          style={{ color: '#22d093', borderColor: '#22d09333', background: '#22d09312' }}>
                          Saved
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap"
                          style={{ color: '#9a9a9d', borderColor: '#ffffff1a', background: '#ffffff08' }}>
                          Unsaved
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end">
                        {isSaved ? (
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#22d093]">
                            <Check size={13} /> Saved
                          </span>
                        ) : (
                          <button type="button" onClick={() => saveOne(l)} disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                                       bg-white/[0.04] border border-white/[0.1] text-[#cfd3dc]
                                       hover:bg-[#ff7a18]/[0.14] hover:border-[#ff7a18]/40 hover:text-[#ffae3c] transition-all
                                       disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
