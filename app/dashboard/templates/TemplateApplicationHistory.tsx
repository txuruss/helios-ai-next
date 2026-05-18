'use client'

import type { TemplateApplicationLog } from '@/lib/actions/templates'
import { NICHE_TEMPLATES } from '@/lib/templates/niche-templates'

interface Props { history: TemplateApplicationLog[] }

const MODE_LABEL: Record<string, string> = {
  append: 'Append', fill_missing: 'Fill Missing', replace_demo_only: 'Demo Only', preview: 'Preview',
}

function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function TemplateApplicationHistory({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="border border-white/[0.07] rounded-2xl p-8 text-center bg-[#0f1012]">
        <p className="text-[12.5px] text-[#6a6a6e]">No templates applied yet. Apply a template above to get started.</p>
      </div>
    )
  }

  return (
    <div className="border border-white/[0.07] rounded-2xl bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Application History</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {history.map((log) => {
          const template = NICHE_TEMPLATES[log.template_key as keyof typeof NICHE_TEMPLATES]
          return (
            <div key={log.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-[18px]">{template?.icon ?? '📋'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white">{template?.name ?? log.template_key}</p>
                <p className="text-[11.5px] text-[#6a6a6e]">
                  {MODE_LABEL[log.apply_mode] ?? log.apply_mode} ·{' '}
                  {log.services_created} services · {log.faqs_created} FAQs
                </p>
                {log.safe_summary && <p className="text-[11px] text-[#6a6a6e] mt-0.5 truncate">{log.safe_summary}</p>}
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[10.5px] font-medium ${log.status === 'completed' ? 'text-[#22d093]' : 'text-[#ff8a7a]'}`}>
                  {log.status}
                </span>
                <p className="text-[10px] text-[#6a6a6e] mt-0.5">{relTime(log.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
