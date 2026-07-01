'use client'

// Add / edit an Audit-to-Close lead. Calls the real server actions; on
// failure the modal stays open and shows the error.

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { createAtcLead, updateAtcLead } from '@/lib/actions/atc'
import { ATC_STATUSES, ATC_STATUS_CONFIG, type AtcLead } from '@/lib/atc/types'

interface Props {
  lead?:   AtcLead | null   // undefined/null = add mode
  onClose: () => void
  onSaved: (leadId?: string) => void
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white ' +
  'placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all'
const labelCls = 'text-[11px] font-medium text-[#9a9a9d] mb-1 block'

export default function AtcLeadModal({ lead, onClose, onSaved }: Props) {
  const editing = !!lead
  const [businessName, setBusinessName] = useState(lead?.business_name ?? '')
  const [industry,     setIndustry]     = useState(lead?.industry ?? '')
  const [location,     setLocation]     = useState(lead?.location ?? '')
  const [website,      setWebsite]      = useState(lead?.website_url ?? '')
  const [maps,         setMaps]         = useState(lead?.google_maps_url ?? '')
  const [phone,        setPhone]        = useState(lead?.phone ?? '')
  const [email,        setEmail]        = useState(lead?.email ?? '')
  const [instagram,    setInstagram]    = useState(lead?.instagram_url ?? '')
  const [facebook,     setFacebook]     = useState(lead?.facebook_url ?? '')
  const [whatsapp,     setWhatsapp]     = useState(lead?.whatsapp_number ?? '')
  const [hours,        setHours]        = useState(lead?.opening_hours ?? '')
  const [rating,       setRating]       = useState(lead?.rating?.toString() ?? '')
  const [reviews,      setReviews]      = useState(lead?.review_count?.toString() ?? '')
  const [services,     setServices]     = useState(lead?.services ?? '')
  const [source,       setSource]       = useState(lead?.source ?? 'manual')
  const [status,       setStatus]       = useState(lead?.status ?? 'new')
  const [notes,        setNotes]        = useState(lead?.notes ?? '')

  const [err, setErr]   = useState<string | null>(null)
  const [saving, start] = useTransition()

  function save() {
    setErr(null)
    if (businessName.trim().length === 0) { setErr('Business name is required.'); return }

    const input = {
      business_name: businessName, industry, location,
      website_url: website, google_maps_url: maps, phone, email,
      instagram_url: instagram, facebook_url: facebook, whatsapp_number: whatsapp,
      opening_hours: hours,
      rating:       rating.trim() === '' ? null : rating,
      review_count: reviews.trim() === '' ? null : reviews,
      services, source, status, notes,
    }
    start(async () => {
      const r = editing ? await updateAtcLead(lead!.id, input) : await createAtcLead(input)
      if (r.ok) onSaved(r.leadId)
      else setErr(r.error ?? 'Could not save lead. Try again.')
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4"
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[620px] rounded-2xl border border-white/[0.10] bg-[#0f1012] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1 sticky top-0 bg-[#0f1012] z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-white">{editing ? 'Edit lead' : 'New lead'}</h2>
            <p className="text-[12px] text-[#6a6a6e] mt-0.5">{editing ? lead!.business_name : 'Audit-to-Close prospect'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#6a6a6e] hover:text-white transition-colors mt-0.5"><X size={14} /></button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Business name *</label>
              <input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Elite Cuts" />
            </div>
            <div>
              <label className={labelCls}>Industry</label>
              <input className={inputCls} value={industry ?? ''} onChange={(e) => setIndustry(e.target.value)} placeholder="Barbershop, med spa, clinic…" />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} value={location ?? ''} onChange={(e) => setLocation(e.target.value)} placeholder="City, area" />
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <input className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} placeholder="manual, research agent, referral…" />
            </div>
            <div>
              <label className={labelCls}>Website URL</label>
              <input className={inputCls} value={website ?? ''} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls}>Google Maps URL</label>
              <input className={inputCls} value={maps ?? ''} onChange={(e) => setMaps(e.target.value)} placeholder="https://maps.google.com/…" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} value={email ?? ''} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Instagram URL</label>
              <input className={inputCls} value={instagram ?? ''} onChange={(e) => setInstagram(e.target.value)} placeholder="instagram.com/…" />
            </div>
            <div>
              <label className={labelCls}>Facebook URL</label>
              <input className={inputCls} value={facebook ?? ''} onChange={(e) => setFacebook(e.target.value)} placeholder="facebook.com/…" />
            </div>
            <div>
              <label className={labelCls}>WhatsApp number</label>
              <input className={inputCls} value={whatsapp ?? ''} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Opening hours</label>
              <input className={inputCls} value={hours ?? ''} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Sat 9–7" />
            </div>
            <div>
              <label className={labelCls}>Google rating (0–5)</label>
              <input className={inputCls} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4.6" inputMode="decimal" />
            </div>
            <div>
              <label className={labelCls}>Review count</label>
              <input className={inputCls} value={reviews} onChange={(e) => setReviews(e.target.value)} placeholder="120" inputMode="numeric" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Services (comma-separated)</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={services ?? ''} onChange={(e) => setServices(e.target.value)} placeholder="Haircut, beard trim, coloring…" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={`${inputCls} cursor-pointer`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {ATC_STATUSES.filter((v) => v !== 'archived').map((v) => (
                  <option key={v} value={v}>{ATC_STATUS_CONFIG[v].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder="Anything observed about this business" />
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
