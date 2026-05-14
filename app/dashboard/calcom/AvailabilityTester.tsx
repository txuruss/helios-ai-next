'use client'

import { useState, useTransition } from 'react'

interface DbService { id: string; name: string }
interface CalcomSlot { time: string; date_key: string }

interface Props {
  services:   DbService[]
  businessId: string
}

export default function AvailabilityTester({ services, businessId }: Props) {
  const [serviceId, setServiceId]   = useState('')
  const [date, setDate]             = useState('')
  const [slots, setSlots]           = useState<CalcomSlot[] | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [pending, startTransition]  = useTransition()

  const check = () => {
    if (!serviceId || !date) return
    setError(null)
    setSlots(null)

    startTransition(async () => {
      try {
        const start = new Date(date)
        start.setHours(0, 0, 0, 0)
        const end = new Date(date)
        end.setHours(23, 59, 59, 999)

        const qs = new URLSearchParams({
          business_id: businessId,
          service_id:  serviceId,
          start:       start.toISOString(),
          end:         end.toISOString(),
          timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        const res  = await fetch(`/api/calcom/availability?${qs}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? 'Unable to fetch availability.')
          return
        }
        setSlots(data.slots ?? [])
      } catch {
        setError('Network error. Please try again.')
      }
    })
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  const fieldCls =
    'h-[42px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3 text-[13.5px] text-white ' +
    'outline-none transition-all focus:border-[#ff7a18]/50 disabled:opacity-50'

  return (
    <div className="border border-white/10 rounded-2xl p-6">
      <h3 className="text-[16px] font-semibold mb-1">Availability Tester</h3>
      <p className="text-[13.5px] text-[#9a9a9d] mb-5">
        Test real Cal.com availability for a mapped service on a specific date.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className={fieldCls + ' flex-1 appearance-none'}
          disabled={pending}>
          <option value="">Select mapped service…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={fieldCls + ' flex-1'}
          disabled={pending}
          min={new Date().toISOString().split('T')[0]}
        />
        <button
          onClick={check}
          disabled={pending || !serviceId || !date}
          className="h-[42px] px-5 rounded-[10px] text-[13.5px] font-medium bg-[#ff7a18]/12 border border-[#ff7a18]/30 text-[#ffae3c] hover:bg-[#ff7a18]/20 transition-all disabled:opacity-40">
          {pending ? 'Checking…' : 'Check Availability'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13px] text-[#ff8a7a]">
          {error}
        </div>
      )}

      {slots !== null && (
        slots.length === 0 ? (
          <div className="border border-dashed border-white/[0.08] rounded-xl p-6 text-center">
            <p className="text-[13.5px] text-[#6a6a6e]">No available slots on this date.</p>
          </div>
        ) : (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#22d093] mb-2">
              {slots.length} slot{slots.length !== 1 ? 's' : ''} available
            </div>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot, i) => (
                <div key={i}
                  className="px-3 py-1.5 rounded-[9px] bg-[#22d093]/[0.08] border border-[#22d093]/20 text-[#22d093] text-[12.5px] font-mono">
                  {formatTime(slot.time)}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
