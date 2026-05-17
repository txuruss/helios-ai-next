'use client'

import { getConfidenceLabel, getConfidenceColor } from '@/lib/ai/confidence'
import type { AiConfidence } from '@/lib/ai/confidence'

interface Props {
  confidence: string | null | undefined
  reason?:    string | null
}

export default function AiConfidenceBadge({ confidence, reason }: Props) {
  const conf  = (confidence ?? 'medium') as AiConfidence
  const label = getConfidenceLabel(conf)
  const color = getConfidenceColor(conf)

  return (
    <div className="flex items-center gap-1.5" title={reason ?? `AI confidence: ${label}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[10px] font-medium" style={{ color }}>
        {label}
      </span>
      {reason && (
        <span className="text-[9.5px] text-[#6a6a6e] hidden group-hover:inline truncate max-w-[120px]">
          — {reason}
        </span>
      )}
    </div>
  )
}
