'use client'

import { useEffect, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'

export interface ResearchFormValues {
  location:      string
  niches:        string[]
  leadTarget:    number
  radiusKm:      number
  saveQualified: boolean
}

// Re-run prefill: a nonce makes repeated re-runs of the same run re-apply.
export interface ResearchFormPrefill {
  location:   string
  niches:     string
  leadTarget: number
  radiusKm:   number
  nonce:      number
}

interface Props {
  onRun:    (values: ResearchFormValues) => void
  loading:  boolean
  disabled: boolean // true when GOOGLE_MAPS_API_KEY is missing
  prefill?: ResearchFormPrefill | null
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white ' +
  'placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all'
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6a6a6e]'

export default function ResearchTaskForm({ onRun, loading, disabled, prefill }: Props) {
  const [location, setLocation]   = useState('')
  const [niches, setNiches]       = useState('')
  const [leadTarget, setLeadTarget] = useState(10)
  const [radiusKm, setRadiusKm]   = useState(10)
  const [saveQualified, setSaveQualified] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Apply a re-run prefill from history. Keyed on nonce so the same run can
  // be re-applied repeatedly.
  useEffect(() => {
    if (!prefill) return
    setLocation(prefill.location)
    setNiches(prefill.niches)
    setLeadTarget(prefill.leadTarget)
    setRadiusKm(prefill.radiusKm)
    setLocalError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    const loc = location.trim()
    const nicheList = niches.split(',').map((n) => n.trim()).filter(Boolean)
    if (loc.length < 2) { setLocalError('Enter a location (city, area, or postcode).'); return }
    if (nicheList.length === 0) { setLocalError('Enter at least one niche, comma-separated.'); return }
    onRun({ location: loc, niches: nicheList, leadTarget, radiusKm, saveQualified })
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-5 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ra-location" className={labelCls}>Location</label>
          <input id="ra-location" type="text" className={inputCls} value={location}
            onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Manchester, UK" disabled={loading} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ra-niches" className={labelCls}>Niches (comma-separated)</label>
          <input id="ra-niches" type="text" className={inputCls} value={niches}
            onChange={(e) => setNiches(e.target.value)} placeholder="e.g. dentist, hair salon, gym" disabled={loading} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ra-target" className={labelCls}>Number of leads</label>
          <input id="ra-target" type="number" min={1} max={50} className={inputCls} value={leadTarget}
            onChange={(e) => setLeadTarget(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ra-radius" className={labelCls}>Radius (km)</label>
          <input id="ra-radius" type="number" min={1} max={100} className={inputCls} value={radiusKm}
            onChange={(e) => setRadiusKm(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} disabled={loading} />
        </div>
        <label className="flex items-center gap-2.5 py-2 cursor-pointer select-none">
          <input type="checkbox" checked={saveQualified} onChange={(e) => setSaveQualified(e.target.checked)}
            disabled={loading} className="w-4 h-4 rounded accent-[#ff7a18] cursor-pointer" />
          <span className="text-[12.5px] text-[#cfd3dc]">Save qualified leads automatically</span>
        </label>
      </div>

      {localError && (
        <div className="text-[12px] text-[#ff8a7a]">{localError}</div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-[#6a6a6e]">
          Radius is advisory in Phase 1 — results are matched by location + niche via Google Places.
        </p>
        <button type="submit" disabled={loading || disabled}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium
                     bg-[#ff7a18]/[0.14] border border-[#ff7a18]/40 text-[#ffae3c]
                     hover:bg-[#ff7a18]/25 hover:text-white transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Researching…' : 'Run Research'}
        </button>
      </div>
    </form>
  )
}
