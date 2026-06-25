'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { submitBusinessRegistration } from '@/lib/actions/registration'

const INDUSTRIES = [
  'Barbershop',
  'Beauty / Spa',
  'Fitness',
  'Home Services',
  'Auto Services',
  'Clinic',
  'Restaurant / Hospitality',
  'Other',
]

const CHANNELS = ['website', 'whatsapp', 'instagram', 'facebook', 'sms', 'email', 'phone']

export default function RegistrationForm({ defaultPlan }: { defaultPlan: 'starter' | 'pro' | 'scale' }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [channels, setChannels] = useState<string[]>([])
  const [services, setServices] = useState('')

  function toggleChannel(c: string) {
    setChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('services', services)
    fd.set('preferred_channels', channels.join(','))

    startTransition(async () => {
      const result = await submitBusinessRegistration(fd)
      if (!result.ok) {
        setError(result.error ?? 'Could not submit registration.')
        return
      }
      // Redirect to the confirmation page. Pass 34 renamed the
      // response field from `audit_id` (legacy business_audits row)
      // to `submission_id` (new audit_submissions row).
      const ref = result.submission_id ? `?audit=${result.submission_id}` : ''
      const destination = params.get('from') === 'audit' ? '/audit/submitted' : '/register-business/submitted'
      router.push(`${destination}${ref}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      {error && (
        <div className="rounded-lg border border-[#ff8a7a]/30 bg-[#ff8a7a]/[0.08] p-3 text-[13px] text-[#ff8a7a]">
          {error}
        </div>
      )}

      {/* Contact */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Your Details</legend>
        <Field label="Your name" name="contact_name" required placeholder="Jane Doe" />
        <Field label="Email" name="contact_email" type="email" required placeholder="you@business.com" />
      </fieldset>

      {/* Business identity */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Business Identity</legend>
        <Field label="Business name" name="business_name" required placeholder="Sunrise Barber Shop" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField label="Industry" name="industry" required options={INDUSTRIES} />
          <Field label="City" name="city" required placeholder="Kingston" />
        </div>
        <Field label="Country" name="country" defaultValue="Jamaica" placeholder="Jamaica" />
      </fieldset>

      {/* Online presence */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Online Presence</legend>
        <Field label="Website" name="website" type="url" placeholder="https://yourbusiness.com" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Instagram" name="instagram" placeholder="@handle" />
          <Field label="Facebook" name="facebook" placeholder="facebook.com/handle" />
          <Field label="WhatsApp" name="whatsapp" placeholder="+1 555 555 5555" />
        </div>
      </fieldset>

      {/* Operations */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Operations</legend>
        <Field label="How do customers book today?" name="current_booking" required placeholder="Phone, DMs, walk-ins…" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Monthly leads" name="monthly_leads" type="number" min={0} defaultValue={50} required />
          <Field label="Team size" name="team_size" type="number" min={1} defaultValue={1} />
        </div>
        <TextareaField label="Biggest problem in your business right now" name="biggest_problem" required
          placeholder="Missed calls, slow replies, lost bookings…" rows={3} />
      </fieldset>

      {/* Services & hours */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Services and Hours</legend>
        <TextareaField label="Services offered (comma separated)" name="services_display"
          value={services} onChange={(e) => setServices(e.target.value)}
          placeholder="Haircut, beard trim, kids cut…" rows={2} />
        <Field label="Business hours summary" name="business_hours" placeholder="Mon-Sat 9am-7pm, Sun closed" />
      </fieldset>

      {/* Tools */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Tools and Channels</legend>
        <Field label="Existing booking software (if any)" name="existing_software" placeholder="Cal.com, Booksy, none…" />
        <div>
          <label className="block text-[12px] text-[#9a9a9d] mb-2">Preferred automation channels</label>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const active = channels.includes(c)
              return (
                <button type="button" key={c} onClick={() => toggleChannel(c)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors
                    ${active
                      ? 'border-[#ff7a18]/40 bg-[#ff7a18]/[0.12] text-[#ffae3c]'
                      : 'border-white/10 bg-white/[0.02] text-[#9a9a9d] hover:text-white'}`}>
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      </fieldset>

      {/* Plan */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Selected Plan</legend>
        <SelectField
          label="Plan"
          name="selected_plan"
          required
          defaultValue={params.get('plan') ?? defaultPlan}
          options={[
            { value: 'starter', label: 'Starter ($997 setup + $149/mo)' },
            { value: 'pro',     label: 'Booking OS ($2,500 setup + $399/mo)' },
            { value: 'scale',   label: 'Helios AIOS ($5,000 setup + $999/mo)' },
          ]}
        />
      </fieldset>

      <button type="submit" disabled={pending}
        className="btn-primary justify-center self-stretch text-center disabled:opacity-60">
        {pending ? 'Submitting…' : 'Submit and Request Audit'}
      </button>

      <p className="text-[12px] text-[#6a6a6e] text-center">
        Your data is private and only used by the Helios AI team to prepare your audit and proposal.
      </p>
    </form>
  )
}

// ── Form field primitives ─────────────────────────────────────────

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-[#9a9a9d]">{label}{rest.required && <span className="text-[#ff8a7a] ml-1">*</span>}</span>
      <input {...rest}
        className="h-10 px-3 rounded-lg border border-white/10 bg-[#0a0a0c] text-[14px] text-white placeholder:text-[#5a5a5d]
                   focus:outline-none focus:border-[#ff7a18]/40 focus:ring-1 focus:ring-[#ff7a18]/25 transition-all" />
    </label>
  )
}

function TextareaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, ...rest } = props
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-[#9a9a9d]">{label}{rest.required && <span className="text-[#ff8a7a] ml-1">*</span>}</span>
      <textarea {...rest}
        className="px-3 py-2 rounded-lg border border-white/10 bg-[#0a0a0c] text-[14px] text-white placeholder:text-[#5a5a5d]
                   focus:outline-none focus:border-[#ff7a18]/40 focus:ring-1 focus:ring-[#ff7a18]/25 transition-all resize-none" />
    </label>
  )
}

interface SelectOption { value: string; label: string }
interface SelectFieldProps {
  label: string
  name: string
  required?: boolean
  defaultValue?: string
  options: ReadonlyArray<string | SelectOption>
}

function SelectField({ label, options, required, ...rest }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-[#9a9a9d]">{label}{required && <span className="text-[#ff8a7a] ml-1">*</span>}</span>
      <select {...rest} required={required}
        className="h-10 px-3 rounded-lg border border-white/10 bg-[#0a0a0c] text-[14px] text-white
                   focus:outline-none focus:border-[#ff7a18]/40 focus:ring-1 focus:ring-[#ff7a18]/25 transition-all">
        {options.map((opt) => {
          if (typeof opt === 'string') return <option key={opt} value={opt}>{opt}</option>
          return <option key={opt.value} value={opt.value}>{opt.label}</option>
        })}
      </select>
    </label>
  )
}
