'use client'

import { useState, useTransition } from 'react'
import { capture } from '@/lib/analytics/posthog'
import type { OpsExportRow } from '@/lib/actions/ops'

interface Props {
  exports:   OpsExportRow[]
  onRefresh: () => void
}

const FORMAT_BADGE: Record<string, string> = {
  csv:  'bg-[#22d093]/10 text-[#22d093]',
  json: 'bg-[#3b9eff]/10 text-[#3b9eff]',
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function ExportHistoryPanel({ exports, onRefresh }: Props) {
  const [running, startTransition] = useTransition()

  const handleRerun = (exp: OpsExportRow) => {
    capture('ops_export_rerun', { export_type: exp.export_type, format: exp.format })
    startTransition(async () => {
      try {
        const filters = { ...(exp.filters ?? {}), ...(exp.sanitized_filters ?? {}) }
        const res = await fetch('/api/ops/export', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ export_type: exp.export_type, format: exp.format, limit: 500, ...filters }),
        })
        if (!res.ok) return
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `${exp.export_type}_${new Date().toISOString().slice(0, 10)}.${exp.format}`
        a.click()
        URL.revokeObjectURL(url)
        onRefresh()
      } catch { /* silent */ }
    })
  }

  if (exports.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] overflow-hidden mt-4">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between"
        onClick={() => capture('ops_export_history_viewed', {})}>
        <p className="text-[11.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.12em]">Export History</p>
        <span className="text-[11px] text-[#6a6a6e]">{exports.length} recent</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {exports.slice(0, 10).map((exp) => (
          <div key={exp.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${FORMAT_BADGE[exp.format] ?? 'bg-white/[0.06] text-[#9a9a9d]'}`}>
                  {exp.format.toUpperCase()}
                </span>
                <p className="text-[12.5px] text-white capitalize">{exp.export_type.replace(/_/g, ' ')}</p>
              </div>
              <p className="text-[10.5px] text-[#6a6a6e] mt-0.5">{exp.row_count} rows · {relTime(exp.created_at)}</p>
            </div>
            <button
              onClick={() => handleRerun(exp)}
              disabled={running}
              className="h-7 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40"
            >
              ↓ Re-export
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
