'use client'

import { X } from 'lucide-react'
import type { AuditAiResult } from '@/lib/data/admin-audit-ai'

const PRIORITY_COLOR: Record<string, string> = {
  low: '#6a6a6e', medium: '#3b9eff', high: '#ffae3c', urgent: '#ff5247',
}

export default function AuditAiResultModal({
  result, businessName, onClose,
}: {
  result: AuditAiResult; businessName: string; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[560px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-white">AI Audit Result</h2>
            <p className="text-[12.5px] text-[#9a9a9d] truncate mt-0.5">{businessName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors shrink-0 mt-0.5">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4 text-[13px]">
          {result.status === 'failed' ? (
            <div className="rounded-xl border border-[#ff5247]/30 bg-[#ff5247]/[0.06] px-3.5 py-3 text-[12.5px] text-[#ff8a7a]">
              The last AI run failed: {result.error_message ?? 'Unknown error.'}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {result.fit_score !== null && <Stat label="Fit" value={`${result.fit_score}/100`} color="#22d093" />}
                {result.urgency_score !== null && <Stat label="Urgency" value={`${result.urgency_score}/100`} color="#ffae3c" />}
                {result.lead_priority && (
                  <Pill color={PRIORITY_COLOR[result.lead_priority] ?? '#6a6a6e'} label={`Priority: ${result.lead_priority}`} />
                )}
                {result.recommended_offer && <Pill color="#a07cff" label={`Offer: ${result.recommended_offer}`} />}
              </div>

              {result.business_summary && <Block title="Business Summary"><p className="text-[#cfd3dc] leading-relaxed">{result.business_summary}</p></Block>}
              {result.automation_opportunities.length > 0 && (
                <Block title="Automation Opportunities"><List items={result.automation_opportunities} /></Block>
              )}
              {result.missing_information.length > 0 && (
                <Block title="Missing Information"><List items={result.missing_information} /></Block>
              )}
              {result.suggested_next_action && <Block title="Suggested Next Action"><p className="text-[#cfd3dc] leading-relaxed">{result.suggested_next_action}</p></Block>}
              {result.founder_notes && <Block title="Founder Notes"><p className="text-[#cfd3dc] leading-relaxed">{result.founder_notes}</p></Block>}

              <p className="text-[10.5px] text-[#6a6a6e] border-t border-white/[0.06] pt-2.5">
                Generated {new Date(result.created_at).toLocaleString()} · AI decision-support only — no actions were taken.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-white/[0.06]">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#9a9a9d] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#6a6a6e] mb-1.5">{title}</p>
      {children}
    </div>
  )
}
function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-1.5 text-[#cfd3dc]">
          <span className="text-[#ff7a18] mt-0.5 shrink-0">→</span><span>{it}</span>
        </li>
      ))}
    </ul>
  )
}
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border"
      style={{ color, borderColor: `${color}33`, background: `${color}10` }}>
      <span className="text-[#6a6a6e] uppercase tracking-[0.06em]">{label}</span><span className="font-semibold tabular-nums">{value}</span>
    </span>
  )
}
function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap capitalize"
      style={{ color, borderColor: `${color}33`, background: `${color}12` }}>
      {label}
    </span>
  )
}
