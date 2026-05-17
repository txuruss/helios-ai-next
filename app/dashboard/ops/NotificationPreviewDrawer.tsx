'use client'

import { useState, useTransition } from 'react'
import { markNotificationDryRun } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface PreviewResult {
  subject:                string
  body_text:              string
  recipients:             string[]
  warning:                string
  preview_type:           string
  rendered_with_template: boolean
}

interface Props {
  ruleId?:      string
  ruleName?:    string
  triggerType?: string
  onClose:      () => void
}

export default function NotificationPreviewDrawer({ ruleId, ruleName, triggerType, onClose }: Props) {
  const [preview,     setPreview]     = useState<PreviewResult | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [dryRunMsg,   setDryRunMsg]   = useState<string | null>(null)
  const [exportMsg,   setExportMsg]   = useState<string | null>(null)
  const [loading,     startLoad]      = useTransition()
  const [dryRunning,  startDryRun]    = useTransition()
  const [exporting,   startExport]    = useTransition()

  const fetchPreview = (isDryRun = false) => {
    setError(null)
    setDryRunMsg(null)
    setExportMsg(null)
    const type = isDryRun ? 'dry_run' : 'rule_preview'

    startLoad(async () => {
      try {
        const res = await fetch('/api/ops/notifications/preview', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ rule_id: ruleId, trigger_type: triggerType, preview_type: type }),
        })
        const data = await res.json() as { ok?: boolean; error?: string } & Partial<PreviewResult>
        if (!res.ok) { setError(data.error ?? 'Preview failed.'); return }
        setPreview(data as PreviewResult)
        capture(isDryRun ? 'ops_notification_dry_run_template_rendered' : 'ops_notification_preview_created', {
          trigger_type:  triggerType,
          has_template:  data.rendered_with_template,
        })
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  const handleDryRun = () => {
    setError(null)
    startDryRun(async () => {
      await fetchPreview(true)
      if (ruleId) {
        await markNotificationDryRun(ruleId, 'success')
        setDryRunMsg('Dry run recorded. No email was sent.')
      }
    })
  }

  const handleExportCsv = () => {
    setExportMsg(null); setError(null)
    startExport(async () => {
      try {
        const res = await fetch('/api/ops/notification-previews/export', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ format: 'csv', rule_id: ruleId, limit: 500 }),
        })
        if (!res.ok) {
          const data = await res.json() as { error?: string }
          setError(data.error ?? 'Export failed.')
          return
        }
        const blob  = await res.blob()
        const url   = URL.createObjectURL(blob)
        const a     = document.createElement('a')
        a.href      = url
        a.download  = `notification-previews-${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setExportMsg('CSV exported.')
        capture('ops_notification_preview_exported', { export_format: 'csv', has_rule: !!ruleId })
      } catch {
        setError('Export failed. Please try again.')
      }
    })
  }

  const handleExportJson = () => {
    setExportMsg(null); setError(null)
    startExport(async () => {
      try {
        const res = await fetch('/api/ops/notification-previews/export', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ format: 'json', rule_id: ruleId, limit: 500 }),
        })
        const data = await res.json() as { ok?: boolean; error?: string; rows?: unknown[]; count?: number }
        if (!res.ok) { setError(data.error ?? 'Export failed.'); return }
        const blob = new Blob([JSON.stringify(data.rows ?? [], null, 2)], { type: 'application/json' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `notification-previews-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setExportMsg(`JSON exported (${data.count ?? 0} rows).`)
        capture('ops_notification_preview_exported', { export_format: 'json', has_rule: !!ruleId })
      } catch {
        setError('Export failed. Please try again.')
      }
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 w-[520px] max-w-[100vw] z-50
                        bg-[#0c0d0f] border-l border-white/[0.06] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Notification Preview</h2>
            {ruleName && <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">{ruleName}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#6a6a6e] hover:text-white transition-colors text-[16px]">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Controls */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => fetchPreview(false)} disabled={loading}
              className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all disabled:opacity-40">
              {loading ? 'Generating…' : '🔍 Preview'}
            </button>
            <button onClick={handleDryRun} disabled={dryRunning || loading}
              className="h-9 px-4 rounded-[10px] text-[13px] border border-[#3b9eff]/30 bg-[#3b9eff]/[0.08] text-[#3b9eff] hover:bg-[#3b9eff]/15 transition-all disabled:opacity-40">
              {dryRunning ? 'Running…' : '▶ Dry Run'}
            </button>
          </div>

          {/* Warning banner */}
          <div className="rounded-xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04] px-4 py-2.5">
            <p className="text-[11.5px] text-[#ffae3c]">
              ⚠ Preview and Dry Run never send a real email. Click <strong>Test Email</strong> in the rule table to send a real test.
            </p>
          </div>

          {error    && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}
          {dryRunMsg && <p className="text-[12px] text-[#22d093]">{dryRunMsg}</p>}
          {exportMsg && <p className="text-[12px] text-[#22d093]">{exportMsg}</p>}

          {preview && (
            <div className="flex flex-col gap-4">
              {/* Template badge */}
              {preview.rendered_with_template && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22d093]/10 text-[#22d093] font-medium">
                    ✓ Rendered with custom template
                  </span>
                </div>
              )}

              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11.5px] font-semibold text-[#9a9a9d] uppercase tracking-[0.1em]">Subject</p>
                <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-4 py-3">
                  <p className="text-[13px] text-white font-medium">{preview.subject}</p>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11.5px] font-semibold text-[#9a9a9d] uppercase tracking-[0.1em]">Body Preview</p>
                <pre className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-4 py-3 text-[12px] text-[#9a9a9d] whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                  {preview.body_text}
                </pre>
              </div>

              {/* Recipients */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11.5px] font-semibold text-[#9a9a9d] uppercase tracking-[0.1em]">Recipients (masked)</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.recipients.map((r, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.06] text-[#9a9a9d]">{r}</span>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="rounded-xl border border-[#22d093]/20 bg-[#22d093]/[0.04] px-4 py-2.5">
                <p className="text-[11.5px] text-[#22d093]">✓ {preview.warning}</p>
              </div>
            </div>
          )}

          {!preview && !loading && !error && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="text-[28px]">📧</span>
              <p className="text-[13px] font-medium text-white">Click Preview to see the rendered notification</p>
              <p className="text-[12px] text-[#6a6a6e]">No email will be sent.</p>
            </div>
          )}

          {/* Export section */}
          <div className="border-t border-white/[0.06] pt-4 mt-2">
            <p className="text-[11px] font-semibold text-[#6a6a6e] uppercase tracking-[0.1em] mb-2.5">Export Preview History</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleExportCsv} disabled={exporting}
                className="h-8 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
                {exporting ? '…' : '⬇ CSV'}
              </button>
              <button onClick={handleExportJson} disabled={exporting}
                className="h-8 px-3 rounded-lg text-[11.5px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.06] transition-all disabled:opacity-40">
                {exporting ? '…' : '⬇ JSON'}
              </button>
            </div>
            <p className="text-[10.5px] text-[#6a6a6e] mt-1.5">
              Exports recent preview records for this rule. Emails are masked.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
