'use client'

// Add / edit an outreach lead. Includes an inline 0–10 scoring checklist
// that drives the score field. Calls the real server actions; on failure
// the modal stays open and shows the error.

import { useState, useTransition } from 'react'
import { X, Check } from 'lucide-react'
import {
  OUTREACH_CONTACT_METHODS, CONTACT_METHOD_LABELS, OUTREACH_REPLY_STATUSES,
  STATUS_CONFIG, SCORING_ITEMS, scoreBand,
} from '@/lib/admin/outreach'
import { createOutreachLead, updateOutreachLead } from '@/lib/actions/admin-outreach'
import type { AdminOutreachLead } from '@/lib/data/admin-outreach'

interface Props {
  lead?:   AdminOutreachLead | null   // undefined/null = add mode
  onClose: () => void
  onSaved: () => void
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white ' +
  'placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all'
const labelCls = 'text-[11px] font-medium text-[#9a9a9d] mb-1 block'

export default function OutreachLeadModal({ lead, onClose, onSaved }: Props) {
  const editing = !!lead
  const [businessName, setBusinessName] = useState(lead?.business_name ?? '')
  const [niche,        setNiche]        = useState(lead?.niche ?? '')
  const [location,     setLocation]     = useState(lead?.location ?? '')
  const [contactMethod, setContactMethod] = useState(lead?.contact_method ?? 'instagram')
  const [instagram,    setInstagram]    = useState(lead?.instagram_url ?? '')
  const [website,      setWebsite]      = useState(lead?.website_url ?? '')
  const [phone,        setPhone]        = useState(lead?.phone ?? '')
  const [email,        setEmail]        = useState(lead?.email ?? '')
  const [status,       setStatus]       = useState(lead?.reply_status ?? 'new')
  const [followUp,     setFollowUp]     = useState(lead?.follow_up_date ?? '')
  const [nextAction,   setNextAction]   = useState(lead?.next_action ?? '')
  const [painFound,    setPainFound]    = useState(lead?.pain_found ?? '')
  const [angle,        setAngle]        = useState(lead?.outreach_angle ?? '')
  const [notes,        setNotes]        = useState(lead?.notes ?? '')

  // Scoring — store as a boolean array of length 10; score = count true.
  const [checks, setChecks] = useState<boolean[]>(() => {
    const init = new Array(SCORING_ITEMS.length).fill(false) as boolean[]
    const n = Math.max(0, Math.min(SCORING_ITEMS.length, lead?.score ?? 0))
    for (let i = 0; i < n; i++) init[i] = true   // reflect existing score count
    return init
  })
  const [showScoring, setShowScoring] = useState(false)
  const score = checks.filter(Boolean).length
  const band = scoreBand(score)

  const [err, setErr]   = useState<string | null>(null)
  const [saving, start] = useTransition()

  function save() {
    setErr(null)
    if (businessName.trim().length === 0) { setErr('Business name is required.'); return }
    if (niche.trim().length === 0)        { setErr('Niche is required.'); return }

    const input = {
      business_name: businessName, niche, location, contact_method: contactMethod,
      instagram_url: instagram, website_url: website, phone, email,
      score, reply_status: status, follow_up_date: followUp,
      next_action: nextAction, pain_found: painFound, outreach_angle: angle, notes,
    }
    start(async () => {
      const r = editing ? await updateOutreachLead(lead!.id, input) : await createOutreachLead(input)
      if (r.ok) onSaved()
      else setErr(r.error ?? 'Could not save lead. Try again.')
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[560px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1 sticky top-0 bg-[#0f1012] z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-white">{editing ? 'Edit lead' : 'Add lead'}</h2>
            <p className="text-[12px] text-[#6a6a6e] mt-0.5">{editing ? lead!.business_name : 'New outreach prospect'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors mt-0.5"><X size={14} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Business name *</label>
              <input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Elite Cuts" />
            </div>
            <div>
              <label className={labelCls}>Niche *</label>
              <input className={inputCls} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Barbershop" />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, area" />
            </div>
            <div>
              <label className={labelCls}>Contact method</label>
              <select className={`${inputCls} cursor-pointer`} value={contactMethod} onChange={(e) => setContactMethod(e.target.value as typeof contactMethod)}>
                {OUTREACH_CONTACT_METHODS.map((m) => <option key={m} value={m}>{CONTACT_METHOD_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Instagram URL</label>
              <input className={inputCls} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/…" />
            </div>
            <div>
              <label className={labelCls}>Website URL</label>
              <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={`${inputCls} cursor-pointer`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {OUTREACH_REPLY_STATUSES.filter((s) => s !== 'archived').map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Follow-up date</label>
              <input type="date" className={inputCls} value={followUp ?? ''} onChange={(e) => setFollowUp(e.target.value)} />
            </div>
          </div>

          {/* Scoring */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowScoring((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
            >
              <span className="text-[12.5px] font-medium text-white">Lead score</span>
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-bold tabular-nums" style={{ color: band.color }}>{score}/10</span>
                <span className="text-[10.5px] font-semibold px-2 py-[2px] rounded-full border"
                  style={{ color: band.color, borderColor: `${band.color}33`, background: `${band.color}12` }}>
                  {band.label}
                </span>
                <span className="text-[11px] text-[#6a6a6e]">{showScoring ? 'Hide' : 'Edit'}</span>
              </span>
            </button>
            {showScoring && (
              <div className="px-3.5 pb-3 flex flex-col gap-1.5 border-t border-white/[0.06] pt-2.5">
                {SCORING_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setChecks((prev) => prev.map((c, idx) => idx === i ? !c : c))}
                    className="flex items-start gap-2.5 text-left group"
                  >
                    <span className={`mt-[1px] w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center transition-colors ${
                      checks[i] ? 'bg-[#ff7a18]/20 border-[#ff7a18]/50 text-[#ffae3c]' : 'border-white/[0.15] text-transparent'
                    }`}>
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className={`text-[12px] leading-snug ${checks[i] ? 'text-[#cfd3dc]' : 'text-[#9a9a9d]'}`}>{item}</span>
                  </button>
                ))}
                <p className="text-[10.5px] text-[#6a6a6e] mt-1">1–4 weak · 5–6 possible · 7–8 good · 9–10 strong</p>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Pain found</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={painFound} onChange={(e) => setPainFound(e.target.value)} placeholder="What problem did you spot?" />
          </div>
          <div>
            <label className={labelCls}>Outreach angle</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="The hook you'll lead with" />
          </div>
          <div>
            <label className={labelCls}>Next action</label>
            <input className={inputCls} value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. Send first DM" />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {err && <p className="text-[12px] text-[#ff8a7a]">{err}</p>}
        </div>

        <div className="flex justify-end gap-2.5 px-5 pb-5">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-[#9a9a9d] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
