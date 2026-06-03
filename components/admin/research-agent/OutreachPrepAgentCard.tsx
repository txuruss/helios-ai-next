'use client'

// Outreach Prep Agent (Phase 1: manual, no API). Surfaces the outreach copy
// already stored on a saved lead + a rule-based follow-up message, with copy
// buttons. Nothing is sent — the founder copies and sends manually.

import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { AgentCard, AgentField, CopyButton, agentPrimaryBtn } from './AgentCard'
import type { SavedResearchLead } from '@/lib/data/admin-research'

// Simple, deterministic follow-up template from stored fields (no AI call).
function followUpMessage(l: SavedResearchLead): string {
  const niche = l.niche ?? 'local service'
  return `Hi ${l.business_name} — following up on my note about helping ${niche} businesses capture missed enquiries and turn them into booked appointments. Worth a quick chat this week?`
}

export default function OutreachPrepAgentCard({
  leads, loading,
}: {
  leads: SavedResearchLead[]; loading: boolean; onOpenSavedLeads: () => void
}) {
  const [selId, setSelId] = useState('')
  const [shown, setShown] = useState<SavedResearchLead | null>(null)
  const sel = leads.find((l) => l.id === selId) ?? null

  return (
    <AgentCard
      icon={<PenLine size={15} />}
      name="Outreach Prep Agent"
      purpose="Generate better manual outreach material for saved leads."
      status="manual"
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selId}
            onChange={(e) => { setSelId(e.target.value); setShown(null) }}
            disabled={loading || leads.length === 0}
            className="px-3 py-2 rounded-xl border border-white/[0.08] bg-[#0f1012] text-[12.5px] text-white cursor-pointer
                       focus:outline-none focus:border-[#ff7a18]/40 transition-all disabled:opacity-50 max-w-[220px]"
          >
            <option value="">{leads.length === 0 ? 'No saved leads' : 'Select a saved lead…'}</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.business_name}</option>)}
          </select>
          <button type="button" onClick={() => setShown(sel)} disabled={!sel} className={agentPrimaryBtn}>
            Generate outreach prep
          </button>
        </div>
      }
    >
      <AgentField label="Input">A saved lead&apos;s stored research.</AgentField>
      <AgentField label="Output preview">Recommended First DM, Cold Email Opening, and a follow-up message.</AgentField>

      {shown && (
        <div className="flex flex-col gap-2.5 mt-1">
          <PrepBlock label="Outreach Angle"       value={shown.outreach_angle} />
          <PrepBlock label="Recommended First DM" value={shown.first_dm} />
          <PrepBlock label="Cold Email Opening"   value={shown.cold_email_opening} />
          <PrepBlock label="Follow-up Message"    value={followUpMessage(shown)} />
        </div>
      )}
    </AgentCard>
  )
}

function PrepBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#6a6a6e]">{label}</div>
        {value && <CopyButton value={value} />}
      </div>
      <div className="text-[12px] text-[#cfd3dc] whitespace-pre-wrap break-words leading-relaxed">{value ?? '—'}</div>
    </div>
  )
}
