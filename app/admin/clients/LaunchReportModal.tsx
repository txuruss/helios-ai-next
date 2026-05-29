'use client'

// Read-only launch report preview. Copy to clipboard + print (new window).
// No DB writes, no status changes — pure presentation of a built report.

import { useState } from 'react'
import { X, Copy, Printer } from 'lucide-react'
import { buildClientLaunchReport, type LaunchReportInput } from '@/lib/admin/client-launch-report'
import type { LaunchState } from '@/lib/admin/launch-state'

const REC_COLOR: Record<LaunchState, string> = {
  ready: '#22d093', active: '#22d093', needs_files: '#ffae3c', needs_payment: '#ffae3c',
  needs_onboarding: '#3b9eff', blocked: '#ff5247', archived: '#6a6a6e',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function LaunchReportModal({ input, onClose }: { input: LaunchReportInput; onClose: () => void }) {
  const report = buildClientLaunchReport(input)
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(report.markdown)
      setCopyState('ok')
      setTimeout(() => setCopyState('idle'), 2500)
    } catch {
      setCopyState('err')
      setTimeout(() => setCopyState('idle'), 3000)
    }
  }

  function print() {
    const w = window.open('', '_blank', 'width=820,height=920')
    if (!w) { setCopyState('err'); return }
    w.document.write(
      `<html><head><title>${escapeHtml(report.title)} — ${escapeHtml(report.clientName)}</title>` +
      `<style>body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;padding:40px;color:#111;` +
      `white-space:pre-wrap;font-size:13px;line-height:1.6;max-width:720px;margin:0 auto}</style></head>` +
      `<body>${escapeHtml(report.markdown)}</body></html>`,
    )
    w.document.close()
    w.focus()
    w.print()
  }

  const recColor = REC_COLOR[input.launchState]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[560px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-white">Launch Report</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[12.5px] text-[#9a9a9d] truncate">{report.clientName}</span>
              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[2px] rounded-full border whitespace-nowrap"
                style={{ color: recColor, borderColor: `${recColor}33`, background: `${recColor}12` }}>
                {report.launchRecommendation}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors shrink-0 mt-0.5">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          <pre className="text-[12px] leading-relaxed text-[#cfd3dc] whitespace-pre-wrap font-mono bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">{report.markdown}</pre>
        </div>

        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-t border-white/[0.06]">
          <span className="text-[12px]" style={{ color: copyState === 'ok' ? '#22d093' : copyState === 'err' ? '#ff8a7a' : 'transparent' }}>
            {copyState === 'ok' ? 'Launch report copied.' : copyState === 'err' ? 'Could not copy report. Please try again.' : ' '}
          </span>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={print}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium text-[#9a9a9d] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all">
              <Printer size={13} /> Print
            </button>
            <button type="button" onClick={copy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white transition-all">
              <Copy size={13} /> Copy Report
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
