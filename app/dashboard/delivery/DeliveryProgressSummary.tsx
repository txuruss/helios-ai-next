'use client'

import type { DeliveryProgress } from '@/lib/actions/delivery'

interface Props { progress: DeliveryProgress }

export default function DeliveryProgressSummary({ progress }: Props) {
  const { total, completed, blocked, in_progress, pending, skipped, percent, launchReady } = progress

  return (
    <div className={`border rounded-2xl p-5 ${
      launchReady
        ? 'border-[#22d093]/25 bg-gradient-to-b from-[#22d093]/[0.05] to-[#0f1012]'
        : blocked > 0
        ? 'border-[#ffae3c]/20 bg-[#ffae3c]/[0.03]'
        : 'border-white/[0.07] bg-[#0f1012]'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] font-semibold text-white">
            {launchReady ? '🚀 Ready to Launch' : '📋 Delivery Progress'}
          </p>
          <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">
            {completed + skipped} of {total} tasks done
          </p>
        </div>
        <span className="text-[22px] font-semibold" style={{ color: launchReady ? '#22d093' : blocked > 0 ? '#ffae3c' : '#ffae3c' }}>
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-4">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${percent}%`, background: launchReady ? '#22d093' : blocked > 0 ? '#ffae3c' : 'linear-gradient(90deg,#ff8a2a,#ffae3c)' }} />
      </div>

      {/* Status pills */}
      <div className="flex gap-3 flex-wrap text-[11.5px]">
        <span className="text-[#22d093]">✓ {completed} completed</span>
        {in_progress > 0 && <span className="text-[#3b9eff]">⋯ {in_progress} in progress</span>}
        {blocked     > 0 && <span className="text-[#ff8a7a]">⊠ {blocked} blocked</span>}
        {pending     > 0 && <span className="text-[#6a6a6e]">○ {pending} pending</span>}
        {skipped     > 0 && <span className="text-[#6a6a6e]">— {skipped} skipped</span>}
      </div>
    </div>
  )
}
