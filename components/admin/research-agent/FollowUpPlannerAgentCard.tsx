'use client'

// Follow-Up Planner Agent (Phase 1: rule-based, no API). Lists saved leads
// whose status means they need action, with a suggested next step. Read-only —
// nothing is sent.

import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { AgentCard, AgentField, agentPrimaryBtn, agentSecondaryBtn } from './AgentCard'
import { LEAD_STATUS_META } from './SavedLeadDetailPanel'
import type { SavedResearchLead } from '@/lib/data/admin-research'

const ACTION_STATUSES = ['ready_for_outreach', 'contacted', 'interested', 'call_booked']

const SUGGESTION: Record<string, string> = {
  ready_for_outreach: 'Send the first message · open in Client Outreach',
  contacted:          'Awaiting reply — send a follow-up',
  interested:         'Move toward booking a call',
  call_booked:        'Prep and confirm the call',
}

export default function FollowUpPlannerAgentCard({
  leads, loading, onOpenSavedLeads,
}: {
  leads: SavedResearchLead[]; loading: boolean; onOpenSavedLeads: () => void
}) {
  const [show, setShow] = useState(false)
  const needAction = leads.filter((l) => ACTION_STATUSES.includes(l.status))

  return (
    <AgentCard
      icon={<CalendarClock size={15} />}
      name="Follow-Up Planner Agent"
      purpose="Help decide which saved leads need follow-up."
      status="manual"
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setShow((s) => !s)} disabled={loading} className={agentPrimaryBtn}>
            {show ? 'Hide follow-ups' : `Review follow-ups${needAction.length ? ` (${needAction.length})` : ''}`}
          </button>
          <button type="button" onClick={onOpenSavedLeads} className={agentSecondaryBtn}>
            Open Saved Leads
          </button>
        </div>
      }
    >
      <AgentField label="Input">Saved leads grouped by status.</AgentField>
      <AgentField label="Output preview">Leads that need action today.</AgentField>

      {show && (
        needAction.length === 0 ? (
          <p className="text-[12px] text-[#9a9a9d] mt-1">No leads need follow-up right now.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] mt-1">
            {needAction.map((l) => {
              const m = LEAD_STATUS_META[l.status] ?? { label: l.status, color: '#6a6a6e' }
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-white truncate">{l.business_name}</p>
                    <p className="text-[11px] text-[#6a6a6e] truncate">{SUGGESTION[l.status] ?? 'Review this lead.'}</p>
                  </div>
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap shrink-0"
                    style={{ color: m.color, borderColor: `${m.color}33`, background: `${m.color}12` }}>
                    {m.label}
                  </span>
                </div>
              )
            })}
          </div>
        )
      )}
    </AgentCard>
  )
}
