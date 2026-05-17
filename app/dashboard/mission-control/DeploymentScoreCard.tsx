'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { getScoreLabel, getScoreColor } from '@/lib/validation/audits'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  score:           number | null
  recommendedPlan: string | null
  criticalCount:   number
  hasAudit:        boolean
}

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center' }

export default function DeploymentScoreCard({ score, recommendedPlan, criticalCount, hasAudit }: Props) {
  useEffect(() => {
    capture('deployment_score_card_viewed', { has_audit: hasAudit, score_bucket: score != null ? Math.floor(score / 20) * 20 : 'none' })
  }, [hasAudit, score])

  const scoreColor = score != null ? getScoreColor(score) : '#6a6a6e'
  const scoreLabel = score != null ? getScoreLabel(score) : 'Not audited'

  if (!hasAudit) {
    return (
      <div className="border border-white/[0.07] rounded-2xl p-5 bg-[#0f1012]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[13px] font-semibold text-white mb-1">Deployment Score</p>
            <p className="text-[12px] text-[#6a6a6e]">
              Audit your booking readiness to find gaps and get a package recommendation.
            </p>
          </div>
          <span className="text-[22px] shrink-0">📊</span>
        </div>
        <div className="px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.02] mb-4">
          <p className="text-[12.5px] text-[#6a6a6e]">No audit run yet</p>
        </div>
        <Link href="/dashboard/audits"
          className="inline-flex h-9 px-4 rounded-[10px] text-[13px] font-medium items-center gap-2
                     bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity">
          Run Deployment Audit →
        </Link>
      </div>
    )
  }

  return (
    <div className={`border rounded-2xl p-5 transition-all ${
      criticalCount > 0 ? 'border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.03]' : 'border-white/[0.07] bg-[#0f1012]'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[13px] font-semibold text-white mb-1">Deployment Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-semibold" style={{ color: scoreColor }}>{score}</span>
            <span className="text-[13px] font-medium" style={{ color: scoreColor }}>{scoreLabel}</span>
          </div>
        </div>
        <span className="text-[22px] shrink-0">📊</span>
      </div>

      {/* Score bar */}
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-4">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score ?? 0}%`, background: scoreColor }} />
      </div>

      {/* Info row */}
      <div className="flex gap-3 flex-wrap text-[12px] mb-4">
        {recommendedPlan && (
          <span className="text-[#ffae3c]">Recommended: {PLAN_LABEL[recommendedPlan] ?? recommendedPlan}</span>
        )}
        {criticalCount > 0 && (
          <span className="text-[#ff8a7a]">{criticalCount} critical gap{criticalCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      <Link href="/dashboard/audits"
        className="text-[12px] text-[#9a9a9d] hover:text-white transition-colors">
        View full audit report →
      </Link>
    </div>
  )
}
