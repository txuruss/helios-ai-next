'use client'

// Orchestrates the Business Research Agent: form → run → results table,
// plus a run history you can re-open ("View Results") or re-run. All work
// happens server-side via the /api/research-agent routes; this only holds
// UI state.

import { useRef, useState } from 'react'
import { AlertCircle, History as HistoryIcon, Loader2, X } from 'lucide-react'
import type { ResearchRunSummary } from '@/lib/data/admin-research'
import ResearchTaskForm, { type ResearchFormValues, type ResearchFormPrefill } from './ResearchTaskForm'
import ResearchResultsTable, { type ResearchResultLead } from './ResearchResultsTable'
import ResearchRunHistory from './ResearchRunHistory'

interface Props {
  apiKeyMissing:   boolean
  migrationNeeded: boolean
  initialRuns:     ResearchRunSummary[]
  historyError?:   string | null
}

interface HistoryView {
  run:   ResearchRunSummary
  leads: ResearchResultLead[]
}

export default function ResearchAgentClient({ apiKeyMissing, migrationNeeded, initialRuns, historyError }: Props) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [leads, setLeads]       = useState<ResearchResultLead[]>([])
  const [runId, setRunId]       = useState<string | null>(null)
  const [hasRun, setHasRun]     = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [runs, setRuns]         = useState<ResearchRunSummary[]>(initialRuns)
  const [prefill, setPrefill]   = useState<ResearchFormPrefill | null>(null)

  // History "View Results" state.
  const [historyView, setHistoryView]       = useState<HistoryView | null>(null)
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null)
  const [historyViewError, setHistoryViewError] = useState<string | null>(null)

  const topRef = useRef<HTMLDivElement | null>(null)

  async function refreshRuns() {
    try {
      const res = await fetch('/api/research-agent/runs', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data?.runs)) setRuns(data.runs as ResearchRunSummary[])
    } catch { /* non-fatal — keep current list */ }
  }

  async function handleRun(values: ResearchFormValues) {
    setLoading(true)
    setError(null)
    setSavedNote(null)
    try {
      const res = await fetch('/api/research-agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError((data?.error ?? 'Research run failed.') + (data?.detail ? ` — ${data.detail}` : ''))
        setLoading(false)
        return
      }
      setLeads((data.leads ?? []) as ResearchResultLead[])
      setRunId(data.runId ?? null)
      setHasRun(true)
      setHistoryView(null) // live results take over the results area
      if (typeof data.savedCount === 'number' && data.savedCount > 0) {
        setSavedNote(`${data.savedCount} qualified lead${data.savedCount !== 1 ? 's' : ''} saved automatically.`)
      }
      await refreshRuns()
    } catch {
      setError('Could not reach the research service.')
    } finally {
      setLoading(false)
    }
  }

  async function handleViewResults(id: string) {
    setHistoryLoadingId(id)
    setHistoryViewError(null)
    try {
      const res = await fetch(`/api/research-agent/runs/${id}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setHistoryViewError(data?.error ?? 'Could not load results for this run.')
        setHistoryView(null)
        return
      }
      setHistoryView({ run: data.run as ResearchRunSummary, leads: (data.leads ?? []) as ResearchResultLead[] })
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      setHistoryViewError('Could not reach the research service.')
      setHistoryView(null)
    } finally {
      setHistoryLoadingId(null)
    }
  }

  function handleRerun(run: ResearchRunSummary) {
    setPrefill({
      location:   run.location ?? '',
      niches:     run.niches.join(', '),
      leadTarget: run.lead_target ?? 10,
      radiusKm:   run.radius_km ?? 10,
      nonce:      Date.now(),
    })
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-5" ref={topRef}>
      {apiKeyMissing && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-3 flex items-start gap-3">
          <AlertCircle size={15} className="text-[#ffae3c] shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-[#ffae3c]">
            <div className="font-medium">Google Maps API key not configured.</div>
            <div className="text-[11.5px] text-[#9a9a9d] mt-0.5">
              Set <code className="font-mono text-[11px]">GOOGLE_MAPS_API_KEY</code> in the server environment
              (never prefix it with <code className="font-mono text-[11px]">NEXT_PUBLIC_</code>) and enable the
              Places API (New). Running research is disabled until then.
            </div>
          </div>
        </div>
      )}

      {migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          Research history is unavailable until migration{' '}
          <code className="font-mono text-[11.5px]">20260606120000_create_research_agent.sql</code> is applied in Supabase.
          You can still run searches, but runs and saved leads won&apos;t persist.
        </div>
      )}

      <ResearchTaskForm onRun={handleRun} loading={loading} disabled={apiKeyMissing} prefill={prefill} />

      {error && (
        <div className="rounded-xl border border-[#ff5247]/30 bg-[#ff5247]/[0.06] px-4 py-3 flex items-start gap-3">
          <AlertCircle size={15} className="text-[#ff8a7a] shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-[#ff8a7a]">{error}</div>
        </div>
      )}

      {savedNote && (
        <div className="rounded-xl border border-[#22d093]/30 bg-[#22d093]/[0.06] px-4 py-2.5 text-[12.5px] text-[#22d093]">
          {savedNote}
        </div>
      )}

      {/* Live run results */}
      {hasRun && !error && (
        leads.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10 text-center text-[13px] text-[#9a9a9d]">
            No businesses matched that location and niche. Try a broader niche or a different location.
          </div>
        ) : (
          <ResearchResultsTable leads={leads} runId={runId} />
        )
      )}

      {/* Historical run results (View Results) */}
      {historyViewError && (
        <div className="rounded-xl border border-[#ff5247]/30 bg-[#ff5247]/[0.06] px-4 py-3 flex items-start gap-3">
          <AlertCircle size={15} className="text-[#ff8a7a] shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-[#ff8a7a]">{historyViewError}</div>
        </div>
      )}

      {historyView && (
        <section className="rounded-2xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.03] overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#ff7a18]/10">
            <div className="flex items-center gap-2 min-w-0">
              <HistoryIcon size={13} className="text-[#ff7a18] shrink-0" />
              <div className="min-w-0">
                <h2 className="text-[13.5px] font-semibold text-white truncate">
                  Results — {historyView.run.title ?? '(untitled run)'}
                </h2>
                <p className="text-[11px] text-[#6a6a6e]">
                  {new Date(historyView.run.created_at).toLocaleString()} ·{' '}
                  {historyView.leads.length} found ·{' '}
                  {historyView.leads.filter((l) => l.saved).length} saved
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setHistoryView(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                         bg-white/[0.04] border border-white/[0.1] text-[#cfd3dc]
                         hover:bg-white/[0.08] hover:text-white transition-all shrink-0">
              <X size={12} /> Close
            </button>
          </header>
          <div className="p-4">
            {historyView.leads.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12.5px] text-[#9a9a9d]">
                No businesses were found in this run. Re-run the search with a broader niche or location.
              </p>
            ) : (
              <ResearchResultsTable leads={historyView.leads} runId={historyView.run.id} />
            )}
          </div>
        </section>
      )}

      <ResearchRunHistory
        runs={runs}
        loading={false}
        error={historyError ?? null}
        loadingRunId={historyLoadingId}
        activeRunId={historyView?.run.id ?? null}
        onViewResults={handleViewResults}
        onRerun={handleRerun}
      />

      {historyLoadingId && !historyView && (
        <div className="flex items-center justify-center gap-2 text-[12px] text-[#9a9a9d] py-2">
          <Loader2 size={13} className="animate-spin" /> Loading results…
        </div>
      )}
    </div>
  )
}
