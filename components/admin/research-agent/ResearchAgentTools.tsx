'use client'

// "Agents" tab for the Business Research Agent. Shows the internal
// research/acquisition agents. Phase 1: only the manual / rule-based modules
// are functional — no external AI APIs, no automated outreach, nothing sent.
// Reuses the existing saved-leads read (GET /api/research-agent/leads/saved).

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { SavedResearchLead } from '@/lib/data/admin-research'
import LeadEnrichmentAgentCard from './LeadEnrichmentAgentCard'
import OutreachPrepAgentCard from './OutreachPrepAgentCard'
import FollowUpPlannerAgentCard from './FollowUpPlannerAgentCard'

export default function ResearchAgentTools({
  migrationNeeded, onOpenSavedLeads,
}: {
  migrationNeeded: boolean
  onOpenSavedLeads: () => void
}) {
  const [leads, setLeads]     = useState<SavedResearchLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (migrationNeeded) { setLoading(false); return }
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/research-agent/leads/saved', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (!res.ok || !data?.ok) setError(data?.error ?? 'Could not load saved leads.')
        else setLeads((data.leads ?? []) as SavedResearchLead[])
      } catch {
        if (active) setError('Could not reach the research service.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [migrationNeeded])

  if (migrationNeeded) {
    return (
      <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
        Agents are unavailable until migration{' '}
        <code className="font-mono text-[11.5px]">20260606120000_create_research_agent.sql</code> is applied in Supabase.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-[#9a9a9d] inline-flex items-center gap-1.5">
        {loading && <Loader2 size={12} className="animate-spin" />}
        Internal research &amp; acquisition agents. Only manual / rule-based modules are active in this phase — nothing is sent automatically.
      </p>

      {error && (
        <div className="rounded-xl border border-[#ff5247]/30 bg-[#ff5247]/[0.06] px-4 py-3 flex items-start gap-3">
          <AlertCircle size={15} className="text-[#ff8a7a] shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-[#ff8a7a]">{error}</div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <LeadEnrichmentAgentCard  leads={leads} loading={loading} onOpenSavedLeads={onOpenSavedLeads} />
        <OutreachPrepAgentCard    leads={leads} loading={loading} onOpenSavedLeads={onOpenSavedLeads} />
        <FollowUpPlannerAgentCard leads={leads} loading={loading} onOpenSavedLeads={onOpenSavedLeads} />
      </div>
    </div>
  )
}
