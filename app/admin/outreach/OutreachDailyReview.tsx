'use client'

// End-of-day outreach review: checklist + short notes fields. Persists to
// admin_outreach_daily_reviews (one row per day) via an upsert action.
// Degrades gracefully if the table isn't there yet (shows the error).

import { useState, useTransition } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { END_OF_DAY_CHECKLIST } from '@/lib/admin/outreach'
import { saveOutreachDailyReview } from '@/lib/actions/admin-outreach'
import type { OutreachDailyReview as Review } from '@/lib/data/admin-outreach'

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white ' +
  'placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all'
const labelCls = 'text-[11px] font-medium text-[#9a9a9d] mb-1 block'

export default function OutreachDailyReview({
  initialReview, reviewDate,
}: {
  initialReview: Review | null
  reviewDate:    string
}) {
  const [open, setOpen] = useState(false)
  const [checks, setChecks] = useState<Record<string, boolean>>(initialReview?.checklist ?? {})
  const [businesses, setBusinesses] = useState(initialReview?.businesses_contacted ?? '')
  const [replies,    setReplies]    = useState(initialReview?.replies ?? '')
  const [bestNiche,  setBestNiche]  = useState(initialReview?.best_niche ?? '')
  const [bestAngle,  setBestAngle]  = useState(initialReview?.best_outreach_angle ?? '')
  const [hottest,    setHottest]    = useState(initialReview?.hottest_lead ?? '')
  const [followUps,  setFollowUps]  = useState(initialReview?.follow_ups_due ?? '')
  const [improve,    setImprove]    = useState(initialReview?.improve_tomorrow ?? '')

  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, start] = useTransition()

  const doneCount = END_OF_DAY_CHECKLIST.filter((i) => checks[i]).length

  function save() {
    setMsg(null)
    start(async () => {
      const r = await saveOutreachDailyReview(reviewDate, {
        businesses_contacted: businesses, replies, best_niche: bestNiche,
        best_outreach_angle: bestAngle, hottest_lead: hottest,
        follow_ups_due: followUps, improve_tomorrow: improve, checklist: checks,
      })
      setMsg(r.ok ? { ok: true, text: 'Review saved.' } : { ok: false, text: r.error ?? 'Could not save review.' })
    })
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold text-white">End-of-Day Review</h2>
          <span className="text-[11px] text-[#6a6a6e] tabular-nums">{doneCount}/{END_OF_DAY_CHECKLIST.length} done</span>
        </div>
        <ChevronDown size={15} className={`text-[#6a6a6e] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-4 flex flex-col gap-4">
          {/* Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {END_OF_DAY_CHECKLIST.map((item) => (
              <button key={item} type="button"
                onClick={() => setChecks((p) => ({ ...p, [item]: !p[item] }))}
                className="flex items-start gap-2.5 text-left">
                <span className={`mt-[1px] w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center transition-colors ${
                  checks[item] ? 'bg-[#22d093]/20 border-[#22d093]/50 text-[#22d093]' : 'border-white/[0.15] text-transparent'
                }`}>
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className={`text-[12px] leading-snug ${checks[item] ? 'text-[#cfd3dc]' : 'text-[#9a9a9d]'}`}>{item}</span>
              </button>
            ))}
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/[0.06] pt-3.5">
            <div><label className={labelCls}>Businesses contacted</label><input className={inputCls} value={businesses} onChange={(e) => setBusinesses(e.target.value)} /></div>
            <div><label className={labelCls}>Replies</label><input className={inputCls} value={replies} onChange={(e) => setReplies(e.target.value)} /></div>
            <div><label className={labelCls}>Best niche</label><input className={inputCls} value={bestNiche} onChange={(e) => setBestNiche(e.target.value)} /></div>
            <div><label className={labelCls}>Best outreach angle</label><input className={inputCls} value={bestAngle} onChange={(e) => setBestAngle(e.target.value)} /></div>
            <div><label className={labelCls}>Hottest lead</label><input className={inputCls} value={hottest} onChange={(e) => setHottest(e.target.value)} /></div>
            <div><label className={labelCls}>Follow-ups due tomorrow</label><input className={inputCls} value={followUps} onChange={(e) => setFollowUps(e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>What to improve tomorrow</label><textarea rows={2} className={`${inputCls} resize-none`} value={improve} onChange={(e) => setImprove(e.target.value)} /></div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {msg && <span className={`text-[12px] ${msg.ok ? 'text-[#22d093]' : 'text-[#ff8a7a]'}`}>{msg.text}</span>}
            <button type="button" onClick={save} disabled={saving}
              className="px-4 py-2 rounded-xl text-[13px] font-medium bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white transition-all disabled:opacity-50">
              {saving ? 'Saving…' : 'Save review'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
