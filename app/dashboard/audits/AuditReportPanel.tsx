'use client'

import { useState, useTransition } from 'react'
import { generateAuditReport } from '@/lib/actions/audits'
import { capture } from '@/lib/analytics/posthog'

interface Props { auditId: string }

export default function AuditReportPanel({ auditId }: Props) {
  const [text,    setText]    = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startGen]   = useTransition()

  const handleGenerate = () => {
    setError(null)
    startGen(async () => {
      const result = await generateAuditReport(auditId, 'copy')
      if (result.error) { setError(result.error); return }
      setText(result.text ?? null)
    })
  }

  const handleCopy = () => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      capture('audit_report_copied', {})
    })
  }

  return (
    <div className="border border-white/[0.07] rounded-2xl bg-[#0f1012] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-white">Sales Report</p>
          <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">Client-friendly audit report ready to copy</p>
        </div>
        <span className="text-[20px]">📄</span>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}

        {!text ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-[13px] text-[#9a9a9d]">
              Generate a client-facing report you can copy, paste, or share in a sales call.
            </p>
            <button onClick={handleGenerate} disabled={pending}
              className="h-10 px-6 rounded-[10px] text-[13.5px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity disabled:opacity-40">
              {pending ? 'Generating…' : '📋 Generate Report'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleCopy}
                className={`h-9 px-4 rounded-[10px] text-[13px] transition-all ${
                  copied
                    ? 'border border-[#22d093]/30 bg-[#22d093]/[0.08] text-[#22d093]'
                    : 'border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white'
                }`}>
                {copied ? '✓ Copied!' : '⎘ Copy to Clipboard'}
              </button>
              <button onClick={() => { setText(null); handleGenerate() }} disabled={pending}
                className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all disabled:opacity-40">
                ↻ Regenerate
              </button>
            </div>
            <pre className="text-[11.5px] text-[#9a9a9d] leading-relaxed whitespace-pre-wrap font-mono bg-black/30 border border-white/[0.06] rounded-xl p-4 max-h-[480px] overflow-y-auto">
              {text}
            </pre>
          </>
        )}
      </div>
    </div>
  )
}
