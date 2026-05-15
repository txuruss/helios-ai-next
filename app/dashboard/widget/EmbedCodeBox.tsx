'use client'

import { useState } from 'react'
import { trackEmbedCopied } from '@/lib/analytics/events'

interface Props {
  widgetId: string
  appUrl:   string
}

export default function EmbedCodeBox({ widgetId, appUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const code = `<script\n  src="${appUrl}/helios-widget.js"\n  data-widget-id="${widgetId}">\n</script>`

  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      trackEmbedCopied(widgetId, '')
    })
  }

  return (
    <div className="border border-white/10 rounded-2xl p-6">
      <h3 className="text-[16px] font-semibold mb-1">Embed Code</h3>
      <p className="text-[13.5px] text-[#9a9a9d] mb-4">
        Paste this snippet just before the closing{' '}
        <code className="font-mono text-[#5be3c5]">&lt;/body&gt;</code> tag on your website.
      </p>

      <pre className="font-mono text-[12px] text-[#5be3c5] bg-[#070708] border border-white/[0.06]
                      rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all select-all mb-3">
        {code}
      </pre>

      <div className="flex items-center gap-3">
        <button onClick={handleCopy} className="btn-ghost btn-sm">
          {copied ? (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.8" strokeLinecap="round"><path d="m4 12 5 5 11-12"/></svg> Copied!</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Code</>
          )}
        </button>
        <span className="text-[11.5px] text-[#6a6a6e] font-mono truncate">{widgetId}</span>
      </div>

      <div className="mt-5 p-4 rounded-xl bg-[#ffae3c]/[0.04] border border-[#ffae3c]/20">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-2">Installation Steps</div>
        <ol className="text-[13px] text-[#9a9a9d] flex flex-col gap-1.5 list-decimal list-inside">
          <li>Copy the snippet above.</li>
          <li>Paste it before <code className="font-mono text-[#5be3c5]">&lt;/body&gt;</code> in your website&apos;s HTML.</li>
          <li>Save and publish — the chat widget appears automatically.</li>
          <li>Test by opening your website and clicking the chat bubble.</li>
        </ol>
      </div>
    </div>
  )
}
