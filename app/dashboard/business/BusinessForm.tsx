'use client'

import { useActionState } from 'react'
import type { Business } from '@/types'
import { BUSINESS_TYPES } from '@/lib/constants'
import { createBusiness, updateBusiness } from '@/lib/actions/business'

interface Props { business: Business | null }

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday',  sat: 'Saturday', sun: 'Sunday',
}

const fieldCls =
  'h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] ' +
  'px-3.5 text-[14px] text-white placeholder:text-[#6a6a6e] outline-none ' +
  'transition-all focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'
const labelCls = 'text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block'

export default function BusinessForm({ business }: Props) {
  const action = business?.id
    ? updateBusiness.bind(null, business.id)
    : createBusiness
  const [state, formAction, pending] = useActionState(action, {})

  const hours = business?.hours as Record<string, { open: string; close: string; closed?: boolean }> | undefined

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13.5px] text-[#ff8a7a]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#22d093]/10 border border-[#22d093]/30 text-[13.5px] text-[#22d093]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="m4 12 5 5 11-12"/></svg>
          {state.success}
        </div>
      )}

      {/* Basic Info */}
      <div className="border border-white/10 rounded-2xl p-6">
        <h3 className="text-[16px] font-semibold mb-5 pb-4 border-b border-white/[0.06]">Basic Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className={labelCls}>Business Name *</label>
            <input name="name" type="text" defaultValue={business?.name ?? ''} required
              placeholder="Island Glow Beauty Studio" className={fieldCls} disabled={pending} />
          </div>
          <div>
            <label className={labelCls}>Business Type</label>
            <select name="business_type" defaultValue={business?.business_type ?? ''} className={fieldCls + ' appearance-none'} disabled={pending}>
              <option value="">Select type…</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input name="phone" type="tel" defaultValue={business?.phone ?? ''} placeholder="+1 (876) 555-0100" className={fieldCls} disabled={pending} />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input name="city" type="text" defaultValue={business?.city ?? ''} placeholder="Kingston" className={fieldCls} disabled={pending} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input name="country" type="text" defaultValue={business?.country ?? 'Jamaica'} className={fieldCls} disabled={pending} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Website URL</label>
            <input name="website_url" type="url" defaultValue={business?.website_url ?? ''} placeholder="https://yourbusiness.com" className={fieldCls} disabled={pending} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea name="description" defaultValue={business?.description ?? ''} rows={3} placeholder="What does your business do?"
              disabled={pending}
              className="w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 py-3 text-[14px] text-white
                         placeholder:text-[#6a6a6e] outline-none resize-none transition-all
                         focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50 disabled:cursor-not-allowed" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Owner Notification Email</label>
            <input name="owner_notification_email" type="email" defaultValue={business?.owner_notification_email ?? ''} placeholder="owner@yourbusiness.com" className={fieldCls} disabled={pending} />
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      <div className="border border-white/10 rounded-2xl p-6">
        <h3 className="text-[16px] font-semibold mb-5 pb-4 border-b border-white/[0.06]">Operating Hours</h3>
        <div className="flex flex-col gap-3">
          {DAYS.map((day) => {
            const h = hours?.[day]
            return (
              <div key={day} className="grid grid-cols-[120px_1fr_1fr_auto] gap-3 items-center">
                <span className="text-[13.5px] font-medium">{DAY_LABELS[day]}</span>
                <input name={`${day}_open`}  type="time" defaultValue={h?.open  ?? '09:00'} className={fieldCls + ' text-center'} disabled={pending} />
                <input name={`${day}_close`} type="time" defaultValue={h?.close ?? '17:00'} className={fieldCls + ' text-center'} disabled={pending} />
                <label className="flex items-center gap-2 text-[13px] text-[#9a9a9d] cursor-pointer whitespace-nowrap">
                  <input name={`${day}_closed`} type="checkbox" defaultChecked={h?.closed ?? day === 'sun'} disabled={pending}
                    className="w-4 h-4 rounded accent-[#ff7a18]" />
                  Closed
                </label>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending}
          className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
          {pending ? (
            <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" /> Saving…</>
          ) : (
            <>{business?.id ? 'Save Changes' : 'Create Business'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m5 12 5 5L20 7"/></svg>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
