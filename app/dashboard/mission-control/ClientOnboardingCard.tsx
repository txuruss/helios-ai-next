'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import type { DeliveryProgress } from '@/lib/actions/delivery'
import type { OnboardingStatus } from '@/lib/validation/onboarding'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  intakeStatus:     OnboardingStatus | 'not_started'
  deliveryProgress: DeliveryProgress
}

const INTAKE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started:   { label: 'Not Started',    color: '#6a6a6e', bg: 'border-white/[0.07] bg-[#0f1012]'        },
  draft:         { label: 'Draft',          color: '#9a9a9d', bg: 'border-white/[0.07] bg-[#0f1012]'        },
  submitted:     { label: 'Submitted',      color: '#3b9eff', bg: 'border-[#3b9eff]/20 bg-[#3b9eff]/[0.04]' },
  in_review:     { label: 'In Review',      color: '#ffae3c', bg: 'border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]' },
  approved:      { label: 'Approved',       color: '#22d093', bg: 'border-[#22d093]/20 bg-[#22d093]/[0.04]' },
  needs_changes: { label: 'Needs Changes',  color: '#ff8a7a', bg: 'border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.04]' },
}

export default function ClientOnboardingCard({ intakeStatus, deliveryProgress }: Props) {
  const cfg = INTAKE_CONFIG[intakeStatus] ?? INTAKE_CONFIG.not_started
  const { percent, blocked, launchReady } = deliveryProgress

  useEffect(() => {
    capture('launch_readiness_viewed', { source: 'onboarding_card', status: intakeStatus })
  }, [intakeStatus])

  return (
    <div className={`border rounded-2xl p-5 transition-all ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[13px] font-semibold text-white">Client Onboarding</p>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
              style={{ color: cfg.color, borderColor: `${cfg.color}40`, background: `${cfg.color}12` }}>
              {cfg.label}
            </span>
          </div>
          <p className="text-[12px] text-[#6a6a6e]">
            {launchReady
              ? 'Delivery complete — ready to launch.'
              : intakeStatus === 'not_started'
              ? 'Complete the onboarding intake to get started.'
              : `Delivery: ${percent}% complete${blocked > 0 ? ` · ${blocked} blocked` : ''}`}
          </p>
        </div>
        <span className="text-[22px] shrink-0">
          {launchReady ? '🚀' : intakeStatus === 'approved' ? '✅' : '📋'}
        </span>
      </div>

      {/* Progress bar */}
      {deliveryProgress.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] text-[#6a6a6e]">{deliveryProgress.completed + deliveryProgress.skipped} / {deliveryProgress.total} tasks</span>
            <span className="text-[11px] font-mono text-[#6a6a6e]">{percent}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${percent}%`,
                background: launchReady ? '#22d093' : blocked > 0 ? '#ffae3c' : 'linear-gradient(90deg,#ff8a2a,#ffae3c)',
              }} />
          </div>
          {blocked > 0 && (
            <p className="text-[10.5px] text-[#ff8a7a] mt-1">{blocked} task{blocked !== 1 ? 's' : ''} blocked</p>
          )}
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/dashboard/onboarding"
          className="h-8 px-3 rounded-lg text-[12px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
          {intakeStatus === 'not_started' || intakeStatus === 'draft' ? 'Start Intake →' : 'View Intake →'}
        </Link>
        {deliveryProgress.total > 0 && (
          <Link href="/dashboard/delivery"
            className="h-8 px-3 rounded-lg text-[12px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.06] text-[#ffae3c] hover:bg-[#ff7a18]/12 transition-all">
            View Pipeline →
          </Link>
        )}
      </div>
    </div>
  )
}
