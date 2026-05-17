'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  reviewRequiredCount:  number
  pendingApprovalCount: number
}

export default function AiReviewCard({ reviewRequiredCount, pendingApprovalCount }: Props) {
  const total = reviewRequiredCount + pendingApprovalCount
  const hasItems = total > 0

  useEffect(() => {
    if (hasItems) capture('ai_review_required_card_viewed', { count: total })
  }, [hasItems, total])

  return (
    <div className={`border rounded-2xl p-5 transition-all ${
      hasItems
        ? 'border-[#c084fc]/30 bg-gradient-to-b from-[#c084fc]/[0.05] to-[#0f1012]'
        : 'border-white/[0.07] bg-[#0f1012]'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[13px] font-semibold text-white">AI Review Queue</p>
            {hasItems && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#c084fc]/15 text-[#c084fc] font-medium">
                {total} pending
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#6a6a6e] leading-relaxed">
            {hasItems
              ? 'Conversations or approval items flagged for human review.'
              : 'No AI responses currently flagged for review.'}
          </p>
        </div>
        <span className="text-[22px] shrink-0">🧠</span>
      </div>

      {hasItems ? (
        <div className="flex flex-col gap-2 mb-4">
          {reviewRequiredCount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-[#c084fc]/20 bg-[#c084fc]/[0.05]">
              <span className="text-[12px] text-[#9a9a9d]">Conversations needing review</span>
              <span className="text-[13px] font-semibold text-[#c084fc]">{reviewRequiredCount}</span>
            </div>
          )}
          {pendingApprovalCount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
              <span className="text-[12px] text-[#9a9a9d]">AI review approvals pending</span>
              <span className="text-[13px] font-semibold text-[#ffae3c]">{pendingApprovalCount}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border border-[#22d093]/20 bg-[#22d093]/[0.04]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.5" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
          <span className="text-[12px] text-[#22d093]">All clear — no AI responses need review</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Link href="/dashboard/ops?tab=approvals"
          className="h-8 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
          Review in Ops →
        </Link>
        <Link href="/dashboard/inbox"
          className="h-8 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
          Open Inbox →
        </Link>
      </div>
    </div>
  )
}
