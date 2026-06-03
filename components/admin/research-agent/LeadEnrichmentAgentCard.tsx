'use client'

// Lead Enrichment Agent (Phase 1: placeholder / manual). No AI API is
// connected yet — enrichment is done manually in Saved Leads for now.

import { Sparkles } from 'lucide-react'
import { AgentCard, AgentField, agentPrimaryBtn, agentSecondaryBtn } from './AgentCard'
import type { SavedResearchLead } from '@/lib/data/admin-research'

export default function LeadEnrichmentAgentCard({
  leads, loading, onOpenSavedLeads,
}: {
  leads: SavedResearchLead[]; loading: boolean; onOpenSavedLeads: () => void
}) {
  return (
    <AgentCard
      icon={<Sparkles size={15} />}
      name="Lead Enrichment Agent"
      purpose="Enrich saved research leads before outreach."
      status="coming_soon"
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" disabled className={agentPrimaryBtn} title="Automated enrichment is not connected yet">
            Enrich selected lead
          </button>
          <button type="button" onClick={onOpenSavedLeads} className={agentSecondaryBtn}>
            Open Saved Leads
          </button>
        </div>
      }
    >
      <AgentField label="Input">
        A saved research lead{loading ? '' : ` (${leads.length} available)`}.
      </AgentField>
      <AgentField label="Output preview">
        Enriched notes, a sharper Problem Found, and a stronger Outreach Angle.
      </AgentField>
      <p className="text-[11.5px] text-[#6a6a6e]">
        Automated enrichment isn&apos;t connected yet. For now, review and enrich leads manually in Saved Leads.
      </p>
    </AgentCard>
  )
}
