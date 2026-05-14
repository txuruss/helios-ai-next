'use client'

import { useActionState, useTransition } from 'react'
import {
  createServiceEventMapping,
  deleteServiceEventMapping,
} from '@/lib/actions/calcom'

interface DbService      { id: string; name: string }
interface DbEventType    { id: string; calcom_id: number | null; title: string; duration_min: number | null }
interface DbMapping      { id: string; service_id: string; calcom_event_type_id: string | null }

interface Props {
  services:   DbService[]
  eventTypes: DbEventType[]
  mappings:   DbMapping[]
}

const fieldCls =
  'h-[42px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3 text-[13.5px] text-white ' +
  'outline-none transition-all focus:border-[#ff7a18]/50 disabled:opacity-50'

export default function ServiceMappingForm({ services, eventTypes, mappings }: Props) {
  const [state, formAction, pending] = useActionState(createServiceEventMapping, {})
  const [delPending, startDel] = useTransition()

  const mappingByService = Object.fromEntries(
    mappings.map((m) => [m.service_id, m])
  )

  const unmappedServices = services.filter((s) => !mappingByService[s.id])

  return (
    <div className="border border-white/10 rounded-2xl p-6">
      <h3 className="text-[16px] font-semibold mb-1">Service → Event Type Mapping</h3>
      <p className="text-[13.5px] text-[#9a9a9d] mb-5">
        Link each Helios service to a Cal.com event type so your AI can check availability and book appointments.
      </p>

      {/* Status messages */}
      {state.error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13px] text-[#ff8a7a]">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#22d093]/10 border border-[#22d093]/30 text-[13px] text-[#22d093]">
          {state.success}
        </div>
      )}

      {/* Existing mappings */}
      {mappings.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-1">Current Mappings</div>
          {mappings.map((m) => {
            const svc = services.find((s) => s.id === m.service_id)
            const et  = eventTypes.find((e) => e.id === m.calcom_event_type_id)
            return (
              <div key={m.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="flex-1 text-[13.5px] font-medium text-white">{svc?.name ?? '—'}</span>
                <svg className="text-[#6a6a6e] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
                <span className="flex-1 text-[13.5px] text-[#9a9a9d]">
                  {et ? `${et.title}${et.duration_min ? ` (${et.duration_min} min)` : ''}` : '—'}
                </span>
                <span className="pill pill-green text-[10.5px]">Mapped</span>
                <button
                  disabled={delPending}
                  onClick={() => { startDel(async () => { await deleteServiceEventMapping(m.id); window.location.reload() }) }}
                  className="h-7 px-3 rounded-lg text-[12px] border border-[#ff6a5a]/20 text-[#ff8a7a] hover:bg-[#ff6a5a]/10 hover:border-[#ff6a5a]/40 transition-all disabled:opacity-40">
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add new mapping */}
      {eventTypes.length === 0 ? (
        <div className="border border-dashed border-white/[0.08] rounded-xl p-6 text-center">
          <p className="text-[13.5px] text-[#6a6a6e]">
            No Cal.com event types synced yet. Click <strong className="text-white">Sync Event Types</strong> above first.
          </p>
        </div>
      ) : unmappedServices.length === 0 ? (
        <div className="border border-dashed border-white/[0.08] rounded-xl p-4 text-center">
          <p className="text-[13px] text-[#6a6a6e]">All services are mapped.</p>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e]">Add Mapping</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6a6a6e] mb-1 block uppercase tracking-[0.1em]">Helios Service</label>
              <select name="service_id" required className={fieldCls + ' w-full appearance-none'} disabled={pending}>
                <option value="">Select service…</option>
                {unmappedServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11.5px] text-[#6a6a6e] mb-1 block uppercase tracking-[0.1em]">Cal.com Event Type</label>
              <select name="calcom_event_type_id" required className={fieldCls + ' w-full appearance-none'} disabled={pending}>
                <option value="">Select event type…</option>
                {eventTypes.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.title}{et.duration_min ? ` (${et.duration_min} min)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className="btn-primary btn-sm disabled:opacity-60">
              {pending ? <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" />Saving…</> : 'Map Service'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
