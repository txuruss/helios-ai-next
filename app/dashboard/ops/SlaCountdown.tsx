'use client'

import { useState, useEffect } from 'react'

interface Props {
  slaDueAt:        string | null
  status:          string
  escalationLevel: number
  compact?:        boolean
}

const RESOLVED_STATUSES = ['resolved','completed','approved','rejected','cancelled']

function computeLabel(slaDueAt: string | null, status: string, escalationLevel: number, now: number): {
  label:    string
  variant:  'ok' | 'warn' | 'urgent' | 'breached' | 'escalated' | 'resolved'
} {
  if (RESOLVED_STATUSES.includes(status)) return { label: 'Resolved', variant: 'resolved' }
  if (!slaDueAt) return { label: '', variant: 'ok' }
  if (escalationLevel > 0)               return { label: `Escalated (L${escalationLevel})`, variant: 'escalated' }

  const remaining = new Date(slaDueAt).getTime() - now

  if (remaining < 0) {
    const over = Math.abs(remaining)
    const m = Math.floor(over / 60_000)
    const h = Math.floor(m / 60)
    const label = h > 0 ? `Overdue ${h}h ${m % 60}m` : `Overdue ${m}m`
    return { label, variant: 'breached' }
  }

  const m = Math.floor(remaining / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)

  let label: string
  if (d > 0)         label = `Due in ${d}d ${h % 24}h`
  else if (h > 0)    label = `Due in ${h}h ${m % 60}m`
  else               label = `Due in ${m}m`

  const variant = m < 15 ? 'urgent' : m < 60 ? 'warn' : 'ok'
  return { label, variant }
}

const VARIANT_STYLE = {
  ok:       'text-[#22d093] bg-[#22d093]/10',
  warn:     'text-[#ffae3c] bg-[#ffae3c]/10',
  urgent:   'text-[#ff7a18] bg-[#ff7a18]/10',
  breached: 'text-[#ff8a7a] bg-[#ff8a7a]/10',
  escalated:'text-[#c084fc] bg-[#c084fc]/10',
  resolved: 'text-[#6a6a6e] bg-white/[0.04]',
}

export default function SlaCountdown({ slaDueAt, status, escalationLevel, compact }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (RESOLVED_STATUSES.includes(status) || !slaDueAt) return
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [status, slaDueAt])

  const { label, variant } = computeLabel(slaDueAt, status, escalationLevel, now)

  if (!label) return null

  return (
    <span className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${VARIANT_STYLE[variant]}`}>
      {compact ? label.replace('Overdue ', '↑').replace('Due in ', '↓') : label}
    </span>
  )
}
