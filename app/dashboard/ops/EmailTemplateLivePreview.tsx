'use client'

// Live client-side email template preview.
// Uses sample values only — no server calls, no email sent.
// Must NOT import from server-only libs.

import { SAFE_TEMPLATE_VARS } from '@/lib/validation/ops'

const SAMPLE: Record<string, string> = {
  '{{title}}':         'Payment failed',
  '{{severity}}':      'critical',
  '{{source}}':        'stripe',
  '{{status}}':        'open',
  '{{priority}}':      'urgent',
  '{{dashboard_url}}': 'https://app.helios.ai/dashboard/ops',
  '{{business_name}}': 'Your Business',
  '{{created_at}}':    'Today',
  '{{sla_due_at}}':    'In 1 hour',
}

function renderTemplate(template: string): { rendered: string; hasUnknown: boolean } {
  let rendered = template
  const found  = template.match(/\{\{[^}]+\}\}/g) ?? []
  const safeSet = new Set(SAFE_TEMPLATE_VARS as unknown as string[])
  const unknown = found.filter((v) => !safeSet.has(v))

  for (const [key, value] of Object.entries(SAMPLE)) {
    rendered = rendered.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
  }
  // Highlight unknown vars with a visible marker
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '[UNKNOWN VAR]')
  return { rendered, hasUnknown: unknown.length > 0 }
}

interface Props {
  subject?: string
  body?:    string
}

export default function EmailTemplateLivePreview({ subject = '', body = '' }: Props) {
  const { rendered: rSubject, hasUnknown: subjectHasUnknown } = renderTemplate(subject)
  const { rendered: rBody,    hasUnknown: bodyHasUnknown    } = renderTemplate(body)

  const hasUnknown  = subjectHasUnknown || bodyHasUnknown
  const hasContent  = subject.trim() || body.trim()
  const subjectLen  = subject.length
  const bodyLen     = body.length

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#0c0d0f] px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#6a6a6e] uppercase tracking-[0.1em]">Live Preview</p>
        <span className="text-[10.5px] text-[#6a6a6e]">Sample values only — no email sent</span>
      </div>

      {/* Unknown variable warning */}
      {hasUnknown && (
        <div className="rounded-lg border border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.05] px-3 py-2">
          <p className="text-[11px] text-[#ff8a7a]">
            Unknown template variables detected. Only allowed: {(SAFE_TEMPLATE_VARS as readonly string[]).join(', ')}
          </p>
        </div>
      )}

      {!hasContent && (
        <p className="text-[12px] text-[#6a6a6e] text-center py-4">
          Start typing a subject or body template to see the preview.
        </p>
      )}

      {/* Subject preview */}
      {subject.trim() && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] text-[#6a6a6e]">Subject</p>
            <span className={`text-[10px] ${subjectLen > 240 ? 'text-[#ff8a7a]' : 'text-[#6a6a6e]'}`}>{subjectLen}/256</span>
          </div>
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
            <p className="text-[12.5px] text-white font-medium break-words">{rSubject || '(empty)'}</p>
          </div>
        </div>
      )}

      {/* Body preview */}
      {body.trim() && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] text-[#6a6a6e]">Body</p>
            <span className={`text-[10px] ${bodyLen > 1800 ? 'text-[#ff8a7a]' : 'text-[#6a6a6e]'}`}>{bodyLen}/2000</span>
          </div>
          <pre className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-[11.5px] text-[#9a9a9d] whitespace-pre-wrap font-sans break-words max-h-[200px] overflow-y-auto">
            {rBody || '(empty)'}
          </pre>
        </div>
      )}

      {/* Allowed variables chip list */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-[#6a6a6e] uppercase tracking-[0.08em]">Allowed variables</p>
        <div className="flex flex-wrap gap-1.5">
          {(SAFE_TEMPLATE_VARS as readonly string[]).map((v) => (
            <button
              key={v}
              type="button"
              className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-[#9a9a9d] hover:bg-white/[0.09] transition-colors font-mono"
              title={`Sample: ${SAMPLE[v]}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
