'use client'

import type { AuditFinding } from '@/lib/actions/audits'

interface Props { findings: AuditFinding[] }

const SEV_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  critical: { label: 'Critical', dot: 'bg-[#ff8a7a]', bg: 'bg-[#ff8a7a]/[0.08]', text: 'text-[#ff8a7a]' },
  high:     { label: 'High',     dot: 'bg-[#ffae3c]', bg: 'bg-[#ffae3c]/[0.08]', text: 'text-[#ffae3c]' },
  medium:   { label: 'Medium',   dot: 'bg-[#3b9eff]', bg: 'bg-[#3b9eff]/[0.08]', text: 'text-[#3b9eff]' },
  low:      { label: 'Low',      dot: 'bg-[#22d093]', bg: 'bg-[#22d093]/[0.08]', text: 'text-[#22d093]' },
}

const CATEGORY_LABEL: Record<string, string> = {
  response_speed: 'Response Speed', booking_flow: 'Booking Flow', lead_capture: 'Lead Capture',
  website: 'Website', whatsapp: 'WhatsApp', trust: 'Trust & Safety', operations: 'Operations',
  automation: 'Automation', follow_up: 'Follow-up', analytics: 'Analytics',
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center',
}

export default function AuditFindingsList({ findings }: Props) {
  if (findings.length === 0) {
    return (
      <div className="border border-white/[0.07] rounded-2xl p-8 text-center bg-[#0f1012]">
        <span className="text-[28px]">✓</span>
        <p className="text-[13px] text-[#22d093] mt-3">No critical findings. System looks healthy.</p>
      </div>
    )
  }

  return (
    <div className="border border-white/[0.07] rounded-2xl bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[13px] font-semibold text-white">Findings</p>
        <span className="text-[11.5px] text-[#6a6a6e]">{findings.length} item{findings.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {findings.map((f) => {
          const cfg = SEV_CONFIG[f.severity] ?? SEV_CONFIG.medium
          return (
            <div key={f.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-[13px] font-medium text-white">{f.title}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-[#6a6a6e]">
                      {CATEGORY_LABEL[f.category] ?? f.category}
                    </span>
                    {f.related_plan && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff7a18]/[0.10] text-[#ffae3c]">
                        {PLAN_LABEL[f.related_plan] ?? f.related_plan}
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <p className="text-[12.5px] text-[#9a9a9d] leading-relaxed mb-2">{f.description}</p>
                  )}
                  {f.recommendation && (
                    <div className="px-3 py-2 rounded-lg bg-white/[0.025] border border-white/[0.06]">
                      <span className="text-[10.5px] font-semibold text-[#ffae3c] uppercase tracking-[0.08em]">Fix: </span>
                      <span className="text-[12px] text-[#9a9a9d]">{f.recommendation}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
