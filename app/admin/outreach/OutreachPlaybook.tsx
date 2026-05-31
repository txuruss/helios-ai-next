'use client'

// Outreach playbook: copyable DM scripts, the follow-up sequence, reply
// templates, and the scoring guide. Pure UI / clipboard only — it sends
// nothing. Collapsible to keep the page uncluttered.

import { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import {
  OUTREACH_SCRIPTS, FOLLOWUP_SEQUENCE, REPLY_TEMPLATES, PRICING_GUIDANCE,
  SCORING_ITEMS,
} from '@/lib/admin/outreach'

type Tab = 'scripts' | 'followups' | 'replies' | 'scoring'

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch { /* clipboard unavailable */ }
  }
  return (
    <button type="button" onClick={copy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-medium border
                 border-white/[0.10] bg-white/[0.03] text-[#cfd3dc] hover:bg-white/[0.07] hover:text-white transition-all">
      {done ? <Check size={12} className="text-[#22d093]" /> : <Copy size={12} />}
      {done ? 'Copied' : label}
    </button>
  )
}

const TAB_LABELS: Record<Tab, string> = {
  scripts: 'DM scripts', followups: 'Follow-up sequence', replies: 'Reply handling', scoring: 'Scoring guide',
}

export default function OutreachPlaybook() {
  const [open, setOpen] = useState(false)
  const [tab, setTab]   = useState<Tab>('scripts')
  const [scriptId, setScriptId] = useState(OUTREACH_SCRIPTS[0]?.id ?? '')
  const activeScript = OUTREACH_SCRIPTS.find((s) => s.id === scriptId) ?? OUTREACH_SCRIPTS[0]

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold text-white">Outreach Playbook</h2>
          <span className="text-[11px] text-[#6a6a6e]">Scripts · Follow-ups · Replies · Scoring</span>
        </div>
        <ChevronDown size={15} className={`text-[#6a6a6e] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 py-2.5 border-b border-white/[0.06] flex-wrap">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  tab === t ? 'bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]'
                            : 'text-[#9a9a9d] hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="px-5 py-4">
            {/* Scripts */}
            {tab === 'scripts' && activeScript && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {OUTREACH_SCRIPTS.map((s) => (
                    <button key={s.id} type="button" onClick={() => setScriptId(s.id)}
                      className={`px-3 py-1 rounded-full text-[11.5px] font-medium border transition-all ${
                        s.id === scriptId ? 'border-[#ff7a18]/40 bg-[#ff7a18]/[0.12] text-[#ffae3c]'
                                          : 'border-white/[0.10] bg-white/[0.02] text-[#9a9a9d] hover:text-white'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <pre className="whitespace-pre-wrap font-sans text-[13px] text-[#dcdcde] leading-relaxed">{activeScript.text}</pre>
                  <div className="mt-3 flex justify-end"><CopyButton text={activeScript.text} label="Copy script" /></div>
                </div>
              </div>
            )}

            {/* Follow-ups */}
            {tab === 'followups' && (
              <div className="flex flex-col gap-2.5">
                {FOLLOWUP_SEQUENCE.map((step, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 flex items-start gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ffae3c] shrink-0 mt-0.5 w-[78px]">{step.day}</span>
                    <p className="text-[12.5px] text-[#dcdcde] leading-relaxed flex-1">{step.text}</p>
                    <CopyButton text={step.text} />
                  </div>
                ))}
              </div>
            )}

            {/* Reply handling */}
            {tab === 'replies' && (
              <div className="flex flex-col gap-2.5">
                {REPLY_TEMPLATES.map((tpl, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-[12px] font-semibold text-white">{tpl.trigger}</span>
                      <CopyButton text={tpl.text} />
                    </div>
                    <p className="text-[12.5px] text-[#cfd3dc] leading-relaxed">{tpl.text}</p>
                  </div>
                ))}
                <p className="text-[11.5px] text-[#9a9a9d] leading-relaxed border-t border-white/[0.06] pt-2.5">
                  {PRICING_GUIDANCE}
                </p>
              </div>
            )}

            {/* Scoring guide */}
            {tab === 'scoring' && (
              <div className="flex flex-col gap-2.5">
                <p className="text-[12px] text-[#9a9a9d]">Score each prospect 0–10 — one point per box that&apos;s true.</p>
                <ul className="flex flex-col gap-1.5">
                  {SCORING_ITEMS.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-[#cfd3dc]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a18] shrink-0 mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  {[
                    { r: '1–4', l: 'Weak lead',   c: '#ff8a7a' },
                    { r: '5–6', l: 'Possible',     c: '#ffae3c' },
                    { r: '7–8', l: 'Good lead',    c: '#3b9eff' },
                    { r: '9–10', l: 'Strong lead', c: '#22d093' },
                  ].map((b) => (
                    <div key={b.r} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                      <div className="text-[13px] font-bold tabular-nums" style={{ color: b.c }}>{b.r}</div>
                      <div className="text-[10.5px] text-[#9a9a9d]">{b.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
