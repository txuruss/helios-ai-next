'use client'

import { useState, useTransition } from 'react'
import type { NicheTemplate } from '@/lib/templates/niche-templates'
import { previewNicheTemplateApplication, applyNicheTemplate } from '@/lib/actions/templates'
import type { TemplatePreview } from '@/lib/actions/templates'
import type { ApplyMode } from '@/lib/validation/templates'
import { capture } from '@/lib/analytics/posthog'

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Booking OS', scale: 'Ops Center' }

interface Props {
  template:   NicheTemplate
  onClose:    () => void
  onApplied:  () => void
}

const MODE_OPTIONS: { value: ApplyMode; label: string; desc: string }[] = [
  { value: 'append',           label: 'Append',       desc: 'Add new services and FAQs without deleting existing data' },
  { value: 'fill_missing',     label: 'Fill Missing',  desc: 'Only fill empty business fields and add missing items' },
  { value: 'replace_demo_only',label: 'Demo Only',     desc: 'Only replace rows tagged as demo data' },
]

export default function TemplatePreviewDrawer({ template, onClose, onApplied }: Props) {
  const [mode,      setMode]      = useState<ApplyMode>('append')
  const [preview,   setPreview]   = useState<TemplatePreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [msg,       setMsg]       = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [previewing, startPreview] = useTransition()
  const [applying,   startApply]   = useTransition()

  const handlePreview = () => {
    setError(null)
    startPreview(async () => {
      const result = await previewNicheTemplateApplication(template.key, mode)
      if (result.error) { setError(result.error); return }
      setPreview(result.preview)
    })
  }

  const handleApply = () => {
    if (!confirmed) { setError('Please confirm you want to apply this template.'); return }
    setError(null)
    startApply(async () => {
      const result = await applyNicheTemplate(template.key, mode)
      if (!result.ok) { setError(result.error ?? 'Apply failed.'); return }
      setMsg(`✓ Applied! ${result.servicesCreated} services and ${result.faqsCreated} FAQs created.`)
      capture('niche_template_applied', { template_key: template.key, apply_mode: mode })
      setTimeout(() => { onApplied(); onClose() }, 2000)
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 w-[560px] max-w-[100vw] z-50 bg-[#0c0d0f] border-l border-white/[0.06] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[22px]">{template.icon}</span>
            <div>
              <h2 className="text-[15px] font-semibold text-white">{template.name}</h2>
              <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">{PLAN_LABEL[template.recommendedPlan]} recommended</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#6a6a6e] hover:text-white text-[16px]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Services */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2.5">Services ({template.services.length})</p>
            <div className="flex flex-col gap-1.5">
              {template.services.map((s) => (
                <div key={s.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[12.5px] text-white">{s.name}</p>
                  <div className="flex gap-2 text-[11px] text-[#6a6a6e]">
                    {s.price_range && <span>{s.price_range}</span>}
                    {s.duration    && <span>{s.duration}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQs */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2.5">FAQs ({template.faqs.length})</p>
            <div className="flex flex-col gap-2">
              {template.faqs.map((f) => (
                <div key={f.question} className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[12px] font-medium text-white">{f.question}</p>
                  <p className="text-[11.5px] text-[#9a9a9d] mt-1 leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Booking rules */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2">Booking Rules</p>
            <p className="text-[12.5px] text-[#9a9a9d] leading-relaxed">{template.bookingRules}</p>
          </div>

          {/* AI persona */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2">AI Persona</p>
            <p className="text-[12.5px] text-[#9a9a9d] leading-relaxed">{template.aiPersona}</p>
          </div>

          {/* Demo messages */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2">Demo Messages</p>
            <div className="flex flex-wrap gap-1.5">
              {template.demoMessages.map((m) => (
                <span key={m} className="text-[11px] px-2.5 py-1 rounded-full border border-[#ff7a18]/20 bg-[#ff7a18]/[0.06] text-[#ffae3c]">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Mode selector */}
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e] mb-2.5">Apply Mode</p>
            <div className="flex flex-col gap-2">
              {MODE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer">
                  <input type="radio" name="mode" value={opt.value} checked={mode === opt.value} onChange={() => setMode(opt.value)}
                    className="accent-[#ff7a18] mt-0.5" />
                  <div>
                    <p className="text-[13px] text-white">{opt.label}</p>
                    <p className="text-[11px] text-[#6a6a6e]">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview result */}
          {preview && (
            <div className="px-4 py-3 rounded-xl border border-[#3b9eff]/20 bg-[#3b9eff]/[0.04] text-[12.5px] text-[#9a9a9d]">
              <p className="font-medium text-white mb-1">Preview ({preview.mode})</p>
              <ul className="flex flex-col gap-0.5">
                <li>Will create {preview.willCreateServices.length} new services</li>
                <li>Will create {preview.willCreateFaqs.length} new FAQs</li>
                {preview.willUpdateBusiness && <li>Will update business type</li>}
                <li>Existing: {preview.existingServices} services, {preview.existingFaqs} FAQs</li>
              </ul>
            </div>
          )}

          {/* Confirm */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-[#ff7a18]" />
            <span className="text-[12.5px] text-[#9a9a9d]">
              I confirm this will add content to my dashboard. Existing data will not be deleted.
            </span>
          </label>

          {error && <p className="text-[12px] text-[#ff8a7a]">{error}</p>}
          {msg   && <p className="text-[12px] text-[#22d093]">{msg}</p>}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pb-4">
            <button onClick={handlePreview} disabled={previewing}
              className="h-9 px-4 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all disabled:opacity-40">
              {previewing ? 'Checking…' : '🔍 Preview Changes'}
            </button>
            <button onClick={handleApply} disabled={applying || !confirmed}
              className="h-9 px-5 rounded-[10px] text-[13px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity disabled:opacity-40">
              {applying ? 'Applying…' : '✓ Apply Template'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
