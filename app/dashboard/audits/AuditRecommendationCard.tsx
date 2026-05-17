'use client'

import Link from 'next/link'
import type { AuditRecommendation } from '@/lib/actions/audits'

interface Props { recommendation: AuditRecommendation }

const PLAN_DISPLAY: Record<string, string> = {
  starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center',
}
const PLAN_COLOR: Record<string, string> = {
  starter: 'border-white/10 bg-[#0f1012]',
  pro:     'border-[#ff7a18]/40 bg-gradient-to-b from-[#ff7a18]/[0.06] to-transparent',
  scale:   'border-[#c084fc]/30 bg-gradient-to-b from-[#c084fc]/[0.05] to-transparent',
}

export default function AuditRecommendationCard({ recommendation: rec }: Props) {
  const planLabel = PLAN_DISPLAY[rec.recommended_plan] ?? rec.recommended_plan
  const colorClass = PLAN_COLOR[rec.recommended_plan] ?? PLAN_COLOR.starter

  return (
    <div className={`border rounded-2xl p-6 ${colorClass}`}>
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Recommended Package</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="text-[26px] font-semibold text-white">{planLabel}</h3>
          <div className="flex gap-3 text-[13.5px] font-mono">
            {rec.setup_fee   && <span className="text-white">{rec.setup_fee}</span>}
            {rec.monthly_fee && <span className="text-[#ffae3c]">{rec.monthly_fee}</span>}
          </div>
        </div>
        {rec.reason && (
          <p className="text-[13.5px] text-[#9a9a9d] mt-3 leading-relaxed max-w-[560px]">{rec.reason}</p>
        )}
      </div>

      {rec.included_features.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2.5">Included</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {rec.included_features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-[13px] text-[#9a9a9d]">
                <svg className="shrink-0 text-[#22d093]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rec.next_steps.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2.5">Next Steps</p>
          <ol className="flex flex-col gap-1.5">
            {rec.next_steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-[#9a9a9d]">
                <span className="w-5 h-5 rounded-full bg-[#ff7a18]/[0.15] border border-[#ff7a18]/20 text-[#ffae3c] text-[10.5px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Link href="/dashboard/onboarding"
          className="h-9 px-5 rounded-[10px] text-[13px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity">
          Start Onboarding →
        </Link>
        <Link href="/demo"
          className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
          View Demo →
        </Link>
      </div>
    </div>
  )
}
