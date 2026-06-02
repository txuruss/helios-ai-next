'use client'

// Orchestrates the Business Research Agent: form → run → results table,
// plus a live-refreshing run history. All work happens server-side via the
// /api/research-agent routes; this only holds UI state.

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { ResearchRunSummary } from '@/lib/data/admin-research'
import ResearchTaskForm, { type ResearchFormValues } from './ResearchTaskForm'
import ResearchResultsTable, { type ResearchResultLead } from './ResearchResultsTable'
import ResearchRunHistory from './ResearchRunHistory'

interface Props {
  apiKeyMissing:   boolean
  migrationNeeded: boolean
  initialRuns:     ResearchRunSummary[]
}

export default function ResearchAgentClient({ apiKeyMissing, migrationNeeded, initialRuns }: Props) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [leads, setLeads]       = useState<ResearchResultLead[]>([])
  const [runId, setRunId]       = useState<string | null>(null)
  const [hasRun, setHasRun]     = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [runs, setRuns]         = useState<ResearchRunSummary[]>(initialRuns)

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
        setError(data?.error ?? 'Research run failed.')
        setLoading(false)
        return
      }
      setLeads((data.leads ?? []) as ResearchResultLead[])
      setRunId(data.runId ?? null)
      setHasRun(true)
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

  return (
    <div className="flex flex-col gap-5">
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

      <ResearchTaskForm onRun={handleRun} loading={loading} disabled={apiKeyMissing} />

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

      {hasRun && !error && (
        leads.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 px-5 py-10 text-center text-[13px] text-[#9a9a9d]">
            No businesses matched that location and niche. Try a broader niche or a different location.
          </div>
        ) : (
          <ResearchResultsTable leads={leads} runId={runId} />
        )
      )}

      <ResearchRunHistory runs={runs} />
    </div>
  )
}
