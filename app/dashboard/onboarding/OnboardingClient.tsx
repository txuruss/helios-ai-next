'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { saveOnboardingDraft, submitOnboardingIntake } from '@/lib/actions/onboarding'
import type { OnboardingIntake } from '@/lib/actions/onboarding'
import { capture } from '@/lib/analytics/posthog'

interface Props {
  initialIntake: OnboardingIntake | null
  loadError:     string | null
}

const inputClass  = 'w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[13px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors'
const textareaClass = `w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-[13px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors resize-none`

const SECTIONS = [
  'Business Basics',
  'Owner Contact',
  'Channels',
  'Services',
  'FAQs',
  'Booking Rules',
  'Branding & AI',
  'Review & Submit',
] as const

const STATUS_PILL: Record<string, string> = {
  draft:         'text-[#6a6a6e] border-white/[0.10] bg-white/[0.04]',
  submitted:     'text-[#3b9eff] border-[#3b9eff]/30 bg-[#3b9eff]/[0.08]',
  in_review:     'text-[#ffae3c] border-[#ffae3c]/30 bg-[#ffae3c]/[0.08]',
  approved:      'text-[#22d093] border-[#22d093]/30 bg-[#22d093]/[0.08]',
  needs_changes: 'text-[#ff8a7a] border-[#ff8a7a]/30 bg-[#ff8a7a]/[0.08]',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', in_review: 'In Review', approved: 'Approved', needs_changes: 'Needs Changes',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/[0.07] rounded-2xl p-6 bg-[#0f1012] flex flex-col gap-4">
      <p className="text-[13px] font-semibold text-white">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-medium text-[#9a9a9d]">{label}</label>
        {hint && <span className="text-[10px] text-[#6a6a6e]">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default function OnboardingClient({ initialIntake, loadError }: Props) {
  const i = initialIntake

  const [ownerName,             setOwnerName]             = useState(i?.owner_name ?? '')
  const [ownerEmail,            setOwnerEmail]            = useState(i?.owner_email ?? '')
  const [ownerPhone,            setOwnerPhone]            = useState(i?.owner_phone ?? '')
  const [businessName,          setBusinessName]          = useState(i?.business_name ?? '')
  const [businessType,          setBusinessType]          = useState(i?.business_type ?? '')
  const [city,                  setCity]                  = useState(i?.city ?? '')
  const [country,               setCountry]               = useState(i?.country ?? '')
  const [websiteUrl,            setWebsiteUrl]            = useState(i?.website_url ?? '')
  const [instagramUrl,          setInstagramUrl]          = useState(i?.instagram_url ?? '')
  const [facebookUrl,           setFacebookUrl]           = useState(i?.facebook_url ?? '')
  const [whatsappNumber,        setWhatsappNumber]        = useState(i?.whatsapp_number ?? '')
  const [servicesNotes,         setServicesNotes]         = useState(i?.services_notes ?? '')
  const [faqNotes,              setFaqNotes]              = useState(i?.faq_notes ?? '')
  const [bookingRulesNotes,     setBookingRulesNotes]     = useState(i?.booking_rules_notes ?? '')
  const [brandNotes,            setBrandNotes]            = useState(i?.brand_notes ?? '')
  const [aiPersonaNotes,        setAiPersonaNotes]        = useState(i?.ai_persona_notes ?? '')
  const [notificationPrefs,     setNotificationPrefs]     = useState(i?.notification_preferences ?? '')
  const [launchNotes,           setLaunchNotes]           = useState(i?.launch_notes ?? '')

  const [activeSection, setActiveSection] = useState(0)
  const [status,         setStatus]       = useState(i?.status ?? 'draft')
  const [msg,            setMsg]          = useState<string | null>(null)
  const [error,          setError]        = useState<string | null>(loadError)
  const [saving,         startSave]       = useTransition()
  const [submitting,     startSubmit]     = useTransition()

  const buildData = () => ({
    owner_name: ownerName, owner_email: ownerEmail, owner_phone: ownerPhone,
    business_name: businessName, business_type: businessType, city, country,
    website_url: websiteUrl, instagram_url: instagramUrl, facebook_url: facebookUrl,
    whatsapp_number: whatsappNumber, services_notes: servicesNotes, faq_notes: faqNotes,
    booking_rules_notes: bookingRulesNotes, brand_notes: brandNotes,
    ai_persona_notes: aiPersonaNotes, notification_preferences: notificationPrefs,
    launch_notes: launchNotes,
  })

  const handleSaveDraft = () => {
    setError(null); setMsg(null)
    startSave(async () => {
      const result = await saveOnboardingDraft(buildData())
      if (result.error) { setError(result.error); return }
      setMsg('Draft saved.')
      capture('onboarding_draft_saved', {})
      setTimeout(() => setMsg(null), 3000)
    })
  }

  const handleSubmit = () => {
    setError(null); setMsg(null)
    if (!businessName.trim()) { setError('Business name is required to submit.'); return }
    if (!ownerName.trim())    { setError('Owner name is required to submit.'); return }

    startSubmit(async () => {
      const result = await submitOnboardingIntake(buildData())
      if (result.error) { setError(result.error); return }
      setStatus('submitted')
      setMsg(result.success ?? 'Intake submitted!')
      capture('onboarding_submitted', {})
    })
  }

  const isSubmitted = ['submitted','in_review','approved'].includes(status)

  return (
    <div className="max-w-[820px]">
      {/* Status + progress */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_PILL[status] ?? STATUS_PILL.draft}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
        <div className="flex gap-1">
          {SECTIONS.map((s, idx) => (
            <button key={s} onClick={() => setActiveSection(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${idx === activeSection ? 'bg-[#ff7a18]' : 'bg-white/[0.15]'}`}
              title={s} />
          ))}
        </div>
        <span className="text-[11.5px] text-[#6a6a6e]">{SECTIONS[activeSection]}</span>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {SECTIONS.map((s, idx) => (
          <button key={s} onClick={() => setActiveSection(idx)}
            className={`h-7 px-3 rounded-lg text-[11.5px] transition-all ${
              idx === activeSection
                ? 'bg-[#ff7a18]/[0.15] border border-[#ff7a18]/30 text-[#ffae3c]'
                : 'border border-white/[0.08] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-[12.5px] text-[#ff8a7a] mb-4">{error}</p>}
      {msg   && <p className="text-[12.5px] text-[#22d093] mb-4">{msg}</p>}

      {/* ── Section 0: Business Basics ── */}
      {activeSection === 0 && (
        <Section title="Business Basics">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name *">
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={256} placeholder="Elite Cuts Barbershop" className={inputClass} />
            </Field>
            <Field label="Business Type">
              <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} maxLength={256} placeholder="Barbershop" className={inputClass} />
            </Field>
            <Field label="City">
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={256} placeholder="Brooklyn" className={inputClass} />
            </Field>
            <Field label="Country">
              <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={256} placeholder="United States" className={inputClass} />
            </Field>
          </div>
          <Field label="Website URL" hint="optional">
            <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} maxLength={512} placeholder="https://elitecuts.com" className={inputClass} />
          </Field>
        </Section>
      )}

      {/* ── Section 1: Owner Contact ── */}
      {activeSection === 1 && (
        <Section title="Owner Contact">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Owner Name *">
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={256} placeholder="Marcus Williams" className={inputClass} />
            </Field>
            <Field label="Owner Email">
              <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={256} placeholder="owner@elitecuts.com" className={inputClass} />
            </Field>
            <Field label="Owner Phone" hint="for internal use only">
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} maxLength={64} placeholder="+1 555 000 0001" className={inputClass} />
            </Field>
          </div>
        </Section>
      )}

      {/* ── Section 2: Channels ── */}
      {activeSection === 2 && (
        <Section title="Channels">
          <Field label="WhatsApp Number" hint="Business WhatsApp number for connection">
            <input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} maxLength={64} placeholder="+1 555 000 0001" className={inputClass} />
          </Field>
          <Field label="Instagram URL" hint="optional">
            <input type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} maxLength={512} placeholder="https://instagram.com/elitecuts" className={inputClass} />
          </Field>
          <Field label="Facebook URL" hint="optional">
            <input type="url" value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} maxLength={512} placeholder="https://facebook.com/elitecuts" className={inputClass} />
          </Field>
        </Section>
      )}

      {/* ── Section 3: Services ── */}
      {activeSection === 3 && (
        <Section title="Services">
          <p className="text-[12.5px] text-[#9a9a9d]">List all services the AI should know about, including names, pricing, and durations.</p>
          <Field label="Services Notes" hint="max 4000 chars">
            <textarea value={servicesNotes} onChange={(e) => setServicesNotes(e.target.value)} maxLength={4000} rows={8}
              placeholder="Classic Haircut — $35–$45, 30 min&#10;Beard Trim — $20–$30, 20 min&#10;Haircut + Beard Combo — $55–$65, 45 min"
              className={textareaClass} />
          </Field>
        </Section>
      )}

      {/* ── Section 4: FAQs ── */}
      {activeSection === 4 && (
        <Section title="FAQs">
          <p className="text-[12.5px] text-[#9a9a9d]">List the top questions customers ask, including policies and common concerns.</p>
          <Field label="FAQ Notes" hint="max 4000 chars">
            <textarea value={faqNotes} onChange={(e) => setFaqNotes(e.target.value)} maxLength={4000} rows={8}
              placeholder="Do you take walk-ins? — Yes, based on availability&#10;How long is a haircut? — About 30–45 min&#10;What payment methods? — Cash, card, Venmo"
              className={textareaClass} />
          </Field>
        </Section>
      )}

      {/* ── Section 5: Booking Rules ── */}
      {activeSection === 5 && (
        <Section title="Booking Rules">
          <p className="text-[12.5px] text-[#9a9a9d]">Describe how the business handles bookings, availability, and cancellations.</p>
          <Field label="Booking Rules Notes" hint="max 4000 chars">
            <textarea value={bookingRulesNotes} onChange={(e) => setBookingRulesNotes(e.target.value)} maxLength={4000} rows={8}
              placeholder="Hours: Mon–Fri 9am–7pm, Sat 9am–5pm&#10;Min lead time: 1 hour&#10;Cancellation: 24-hour notice&#10;Max booking window: 14 days"
              className={textareaClass} />
          </Field>
        </Section>
      )}

      {/* ── Section 6: Branding & AI ── */}
      {activeSection === 6 && (
        <Section title="Branding & AI Persona">
          <Field label="Brand Notes" hint="colour, tone, feel — max 2000 chars">
            <textarea value={brandNotes} onChange={(e) => setBrandNotes(e.target.value)} maxLength={2000} rows={4}
              placeholder="Premium barbershop feel. Professional but friendly. Brooklyn edge."
              className={textareaClass} />
          </Field>
          <Field label="AI Persona Instructions" hint="how should the AI introduce itself and talk? — max 2000 chars">
            <textarea value={aiPersonaNotes} onChange={(e) => setAiPersonaNotes(e.target.value)} maxLength={2000} rows={4}
              placeholder="Greet warmly, use 'we' and 'our team', stay concise, push toward booking."
              className={textareaClass} />
          </Field>
          <Field label="Notification Preferences" hint="when should the owner be notified?">
            <textarea value={notificationPrefs} onChange={(e) => setNotificationPrefs(e.target.value)} maxLength={1000} rows={3}
              placeholder="Email for new leads and bookings. WhatsApp for urgent handoffs."
              className={textareaClass} />
          </Field>
        </Section>
      )}

      {/* ── Section 7: Review & Submit ── */}
      {activeSection === 7 && (
        <Section title="Review & Submit">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
            {[
              { label: 'Business',      value: businessName || '—' },
              { label: 'Owner',         value: ownerName || '—' },
              { label: 'City',          value: city || '—' },
              { label: 'Website',       value: websiteUrl || '—' },
              { label: 'WhatsApp',      value: whatsappNumber || '—' },
              { label: 'Services',      value: servicesNotes ? `${servicesNotes.slice(0, 60)}…` : '—' },
              { label: 'FAQs',          value: faqNotes ? `${faqNotes.slice(0, 60)}…` : '—' },
              { label: 'Booking Rules', value: bookingRulesNotes ? `${bookingRulesNotes.slice(0, 60)}…` : '—' },
            ].map((r) => (
              <div key={r.label} className="border border-white/[0.06] rounded-xl px-3 py-2.5 bg-white/[0.02]">
                <p className="text-[10.5px] text-[#6a6a6e] uppercase tracking-[0.08em] mb-1">{r.label}</p>
                <p className="text-[12.5px] text-white truncate">{r.value}</p>
              </div>
            ))}
          </div>

          {isSubmitted ? (
            <div className="px-4 py-3 rounded-xl border border-[#22d093]/20 bg-[#22d093]/[0.05]">
              <p className="text-[12.5px] text-[#22d093]">
                ✓ Intake submitted. View your delivery pipeline to track progress.
              </p>
              <Link href="/dashboard/delivery" className="text-[12px] text-[#ffae3c] hover:underline mt-1 inline-block">
                Open Delivery Pipeline →
              </Link>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
              <p className="text-[12.5px] text-[#ffae3c]">
                Once submitted, a delivery pipeline will be created with all setup tasks.
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-6 flex-wrap">
        <button onClick={handleSaveDraft} disabled={saving || isSubmitted}
          className="h-9 px-5 rounded-[10px] text-[13px] border border-white/[0.10] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white transition-all disabled:opacity-40">
          {saving ? 'Saving…' : '💾 Save Draft'}
        </button>
        {!isSubmitted && (
          <button onClick={handleSubmit} disabled={submitting}
            className="h-9 px-5 rounded-[10px] text-[13px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity disabled:opacity-40">
            {submitting ? 'Submitting…' : '🚀 Submit Intake'}
          </button>
        )}
        {isSubmitted && (
          <Link href="/dashboard/delivery"
            className="h-9 px-5 rounded-[10px] text-[13px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity flex items-center">
            View Delivery Pipeline →
          </Link>
        )}
        {activeSection < SECTIONS.length - 1 && (
          <button onClick={() => setActiveSection((v) => v + 1)}
            className="h-9 px-4 rounded-[10px] text-[13px] border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c] hover:bg-[#ff7a18]/15 transition-all">
            Next Section →
          </button>
        )}
      </div>
    </div>
  )
}
