'use client'

import { useActionState, useEffect } from 'react'
import { createService, updateService } from '@/lib/actions/services'
import type { Service } from '@/types'

interface Props {
  service?: Service | null
  onClose: () => void
}

const fieldCls =
  'h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] ' +
  'text-white placeholder:text-[#6a6a6e] outline-none transition-all ' +
  'focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50'
const labelCls = 'text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block'

export default function ServiceModal({ service, onClose }: Props) {
  const action = service ? updateService.bind(null, service.id) : createService
  const [state, formAction, pending] = useActionState(action, {})

  useEffect(() => {
    if (state.success) onClose()
  }, [state.success, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0f1012] border border-white/10 rounded-2xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-semibold">
            {service ? 'Edit Service' : 'Add Service'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#6a6a6e] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {state.error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13px] text-[#ff8a7a]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Service Name *</label>
            <input name="name" type="text" required defaultValue={service?.name ?? ''} placeholder="e.g. Signature Facial" className={fieldCls} disabled={pending} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea name="description" rows={2} defaultValue={service?.description ?? ''} placeholder="Brief description of this service…"
              disabled={pending}
              className="w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 py-3 text-[14px] text-white placeholder:text-[#6a6a6e] outline-none resize-none transition-all focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Price (cents)</label>
              <input name="price_cents" type="number" min="0" step="100"
                defaultValue={service?.price_cents ?? ''}
                placeholder="e.g. 12000 = $120"
                className={fieldCls} disabled={pending} />
              <p className="text-[11px] text-[#6a6a6e] mt-1">Enter in cents (e.g. 12000 = $120.00)</p>
            </div>
            <div>
              <label className={labelCls}>Duration (min)</label>
              <input name="duration_min" type="number" min="5" max="480" step="5"
                defaultValue={service?.duration_min ?? ''}
                placeholder="e.g. 60"
                className={fieldCls} disabled={pending} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input name="is_active" type="hidden" value="true" />
            <label className="flex items-center gap-2 cursor-pointer text-[13.5px]">
              <input type="checkbox" name="is_active_toggle"
                defaultChecked={service?.is_active ?? true}
                onChange={(e) => {
                  const hiddenInput = e.currentTarget.form?.elements.namedItem('is_active') as HTMLInputElement | null
                  if (hiddenInput) hiddenInput.value = e.currentTarget.checked ? 'true' : 'false'
                }}
                className="w-4 h-4 rounded accent-[#ff7a18]" />
              Active (visible to AI assistant)
            </label>
          </div>

          <div className="flex gap-3 pt-2 border-t border-white/[0.06] mt-2">
            <button type="submit" disabled={pending}
              className="flex-1 btn-primary justify-center disabled:opacity-60">
              {pending
                ? <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" /> Saving…</>
                : service ? 'Save Changes' : 'Create Service'}
            </button>
            <button type="button" onClick={onClose}
              className="h-11 px-5 rounded-[11px] border border-white/10 text-[14px] text-[#9a9a9d] hover:text-white hover:border-white/20 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
