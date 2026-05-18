'use client'

import type { NicheTemplate } from '@/lib/templates/niche-templates'
import { capture } from '@/lib/analytics/posthog'

const PLAN_LABEL: Record<string, string>  = { starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center' }
const PLAN_COLOR: Record<string, string>  = { starter: 'text-[#9a9a9d]', pro: 'text-[#ffae3c]', scale: 'text-[#c084fc]' }
const COMPLEXITY: Record<string, string>  = { simple: '⚡ Simple', standard: '🔧 Standard', advanced: '⚙ Advanced' }

interface Props {
  template:    NicheTemplate
  onPreview:   (t: NicheTemplate) => void
  onApply:     (t: NicheTemplate) => void
}

export default function TemplateCard({ template, onPreview, onApply }: Props) {
  return (
    <div className="border border-white/[0.07] rounded-2xl p-5 bg-[#0f1012] flex flex-col gap-4
                    hover:border-[#ff7a18]/25 transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[28px]">{template.icon}</span>
          <div>
            <p className="text-[14px] font-semibold text-white">{template.name}</p>
            <p className={`text-[11px] font-semibold ${PLAN_COLOR[template.recommendedPlan] ?? ''}`}>
              {PLAN_LABEL[template.recommendedPlan] ?? template.recommendedPlan} recommended
            </p>
          </div>
        </div>
        <span className="text-[10.5px] text-[#6a6a6e] shrink-0">{COMPLEXITY[template.setupComplexity] ?? template.setupComplexity}</span>
      </div>

      {/* Description */}
      <p className="text-[12.5px] text-[#9a9a9d] leading-relaxed">{template.description}</p>

      {/* Meta */}
      <div className="flex gap-4 text-[11.5px] text-[#6a6a6e] flex-wrap">
        <span>📋 {template.services.length} services</span>
        <span>❓ {template.faqs.length} FAQs</span>
        {template.estimatedSetupTime && <span>⏱ {template.estimatedSetupTime}</span>}
      </div>

      {/* Ideal for */}
      {template.idealFor.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {template.idealFor.slice(0, 3).map((label) => (
            <span key={label} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[#9a9a9d]">
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto flex-wrap">
        <button
          onClick={() => { capture('niche_template_previewed', { template_key: template.key }); onPreview(template) }}
          className="h-8 px-3 rounded-lg text-[12px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all">
          Preview
        </button>
        <button
          onClick={() => onApply(template)}
          className="h-8 px-4 rounded-lg text-[12px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity">
          Apply Template
        </button>
      </div>
    </div>
  )
}
