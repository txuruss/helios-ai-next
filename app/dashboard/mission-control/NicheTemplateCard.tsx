'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { getRecommendedTemplateByBusinessType, NICHE_TEMPLATES } from '@/lib/templates/niche-templates'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  businessType:         string | null
  lastAppliedTemplate:  string | null
}

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center' }

export default function NicheTemplateCard({ businessType, lastAppliedTemplate }: Props) {
  const suggested = getRecommendedTemplateByBusinessType(businessType)
  const lastApplied = lastAppliedTemplate ? NICHE_TEMPLATES[lastAppliedTemplate as keyof typeof NICHE_TEMPLATES] : null

  useEffect(() => {
    capture('niche_template_suggested', {
      has_suggestion:    !!suggested,
      template_key:      suggested?.key,
      recommended_plan:  suggested?.recommendedPlan,
    })
  }, [suggested?.key])

  return (
    <div className="border border-white/[0.07] rounded-2xl p-5 bg-[#0f1012]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[13px] font-semibold text-white mb-1">Niche Template</p>
          <p className="text-[12px] text-[#6a6a6e]">
            {lastApplied
              ? `Last applied: ${lastApplied.name} ${lastApplied.icon}`
              : suggested
              ? `Suggested for your business type`
              : 'Ready-made setup for local service businesses'}
          </p>
        </div>
        <span className="text-[22px] shrink-0">📋</span>
      </div>

      {suggested && !lastApplied && (
        <div className="px-3 py-2.5 rounded-xl border border-[#ff7a18]/20 bg-[#ff7a18]/[0.05] mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[16px]">{suggested.icon}</span>
            <p className="text-[13px] font-semibold text-white">{suggested.name}</p>
            <span className="text-[10px] text-[#ffae3c]">{PLAN_LABEL[suggested.recommendedPlan]}</span>
          </div>
          <p className="text-[11.5px] text-[#9a9a9d]">{suggested.description}</p>
        </div>
      )}

      {lastApplied && (
        <div className="px-3 py-2.5 rounded-xl border border-[#22d093]/20 bg-[#22d093]/[0.04] mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[16px]">{lastApplied.icon}</span>
            <p className="text-[12.5px] font-medium text-white">{lastApplied.name} template applied</p>
            <svg className="text-[#22d093]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Link href="/dashboard/templates"
          className={`h-8 px-3 rounded-lg text-[12px] transition-all ${
            suggested && !lastApplied
              ? 'bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium hover:opacity-90'
              : 'border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white'
          }`}>
          {lastApplied ? 'Browse Templates →' : suggested ? 'Apply Template →' : 'Browse Templates →'}
        </Link>
        <Link href="/dashboard/onboarding"
          className="h-8 px-3 rounded-lg text-[12px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
          Onboarding →
        </Link>
      </div>
    </div>
  )
}
