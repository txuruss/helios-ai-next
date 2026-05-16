'use client'

import { useState } from 'react'

interface Props {
  onSnooze:   (snoozedUntil: string, reason?: string) => void
  onClose:    () => void
  disabled?:  boolean
}

const PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '1 hour',   minutes: 60    },
  { label: '4 hours',  minutes: 240   },
  { label: '24 hours', minutes: 1440  },
  { label: '7 days',   minutes: 10080 },
]

const MAX_SNOOZE_DAYS = 30

export default function SnoozePicker({ onSnooze, onClose, disabled }: Props) {
  const [mode,      setMode]      = useState<'presets' | 'custom'>('presets')
  const [customDate,setCustomDate]= useState('')
  const [customTime,setCustomTime]= useState('')
  const [reason,    setReason]    = useState('')
  const [error,     setError]     = useState<string | null>(null)

  const handlePreset = (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60_000).toISOString()
    onSnooze(until, reason || undefined)
    onClose()
  }

  const handleCustom = () => {
    setError(null)
    if (!customDate) { setError('Please select a date.'); return }

    const until = new Date(`${customDate}T${customTime || '00:00'}:00`)
    if (isNaN(until.getTime())) { setError('Invalid date or time.'); return }
    if (until.getTime() <= Date.now()) { setError('Snooze time must be in the future.'); return }

    const maxDate = new Date(Date.now() + MAX_SNOOZE_DAYS * 24 * 60 * 60 * 1000)
    if (until > maxDate) { setError(`Snooze cannot exceed ${MAX_SNOOZE_DAYS} days.`); return }

    onSnooze(until.toISOString(), reason || undefined)
    onClose()
  }

  // Min date for date input (today)
  const minDate = new Date().toISOString().slice(0, 10)
  const maxDate = new Date(Date.now() + MAX_SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const inputCls = 'w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 text-[13px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors'

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.08] bg-[#0c0d0f] w-64 shadow-2xl">
      <p className="text-[12px] font-semibold text-[#9a9a9d] uppercase tracking-[0.1em]">Snooze until</p>

      {/* Mode toggle */}
      <div className="flex gap-1">
        <button onClick={() => setMode('presets')}
          className={`flex-1 h-7 rounded-lg text-[11.5px] font-medium transition-all ${mode === 'presets' ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
          Presets
        </button>
        <button onClick={() => setMode('custom')}
          className={`flex-1 h-7 rounded-lg text-[11.5px] font-medium transition-all ${mode === 'custom' ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
          Custom
        </button>
      </div>

      {mode === 'presets' && (
        <div className="flex flex-col gap-1">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => handlePreset(p.minutes)} disabled={disabled}
              className="w-full text-left px-3 py-2 rounded-lg text-[12.5px] text-[#9a9a9d] hover:bg-white/[0.06] hover:text-white transition-colors disabled:opacity-40">
              {p.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'custom' && (
        <div className="flex flex-col gap-2">
          <input type="date" value={customDate} min={minDate} max={maxDate}
            onChange={(e) => setCustomDate(e.target.value)} className={inputCls} />
          <input type="time" value={customTime}
            onChange={(e) => setCustomTime(e.target.value)} className={inputCls} />
          {error && <p className="text-[11px] text-[#ff8a7a]">{error}</p>}
        </div>
      )}

      {/* Optional reason */}
      <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)" maxLength={256}
        className={`${inputCls} text-[12px]`} />

      {mode === 'custom' && (
        <div className="flex gap-2">
          <button onClick={handleCustom} disabled={disabled}
            className="flex-1 h-8 rounded-lg bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] text-[12.5px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
            Snooze
          </button>
          <button onClick={onClose}
            className="h-8 px-3 rounded-lg border border-white/[0.10] text-[#9a9a9d] text-[12.5px] hover:bg-white/[0.04] transition-all">
            Cancel
          </button>
        </div>
      )}

      {mode === 'presets' && (
        <button onClick={onClose}
          className="h-8 rounded-lg border border-white/[0.10] text-[#9a9a9d] text-[12.5px] hover:bg-white/[0.04] transition-all">
          Cancel
        </button>
      )}
    </div>
  )
}
