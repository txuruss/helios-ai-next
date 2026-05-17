'use client'

import type { BusinessAudit } from '@/lib/actions/audits'
import { getScoreLabel, getScoreColor } from '@/lib/validation/audits'

interface Props { audit: BusinessAudit }

const CATEGORY_SCORES = [
  { key: 'response_score',     label: 'Customer Response', weight: '25%' },
  { key: 'booking_score',      label: 'Booking Flow',      weight: '25%' },
  { key: 'lead_capture_score', label: 'Lead Capture',      weight: '20%' },
  { key: 'trust_score',        label: 'Trust & Safety',    weight: '15%' },
  { key: 'automation_score',   label: 'Automation',        weight: '15%' },
] as const

export default function AuditScoreCard({ audit }: Props) {
  const scoreColor = getScoreColor(audit.overall_score)
  const scoreLabel = getScoreLabel(audit.overall_score)

  return (
    <div className="border border-white/[0.07] rounded-2xl bg-[#0f1012] overflow-hidden">
      {/* Overall score */}
      <div className="px-6 py-5 flex items-center gap-6 border-b border-white/[0.06]">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.9" fill="none"
              stroke={scoreColor} strokeWidth="3.5"
              strokeDasharray={`${audit.overall_score} ${100 - audit.overall_score}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[18px] font-semibold text-white">{audit.overall_score}</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] text-[#6a6a6e] uppercase tracking-[0.12em] mb-1">Overall Score</p>
          <p className="text-[22px] font-semibold" style={{ color: scoreColor }}>{scoreLabel}</p>
          {audit.summary && (
            <p className="text-[12.5px] text-[#9a9a9d] mt-1 max-w-[360px] leading-relaxed">{audit.summary}</p>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="px-6 py-4 flex flex-col gap-3">
        {CATEGORY_SCORES.map(({ key, label, weight }) => {
          const score = audit[key] as number
          const color = getScoreColor(score)
          return (
            <div key={key}>
              <div className="flex justify-between mb-1.5">
                <span className="text-[12.5px] text-[#9a9a9d]">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#6a6a6e]">{weight}</span>
                  <span className="text-[12.5px] font-semibold" style={{ color }}>{score}/100</span>
                </div>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${score}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
