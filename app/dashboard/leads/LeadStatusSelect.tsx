'use client'

import { useTransition } from 'react'
import { updateLeadStatus } from '@/lib/actions/leads'

const STATUSES = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'] as const
type LeadStatus = (typeof STATUSES)[number]

const STATUS_COLORS: Record<LeadStatus, string> = {
  new:       'text-[#ffae3c] border-[#ffae3c]/30 bg-[#ffae3c]/[0.08]',
  qualified: 'text-[#22d093] border-[#22d093]/30 bg-[#22d093]/[0.08]',
  contacted: 'text-[#5be3c5] border-[#5be3c5]/30 bg-[#5be3c5]/[0.08]',
  proposal:  'text-[#ffb547] border-[#ffb547]/30 bg-[#ffb547]/[0.08]',
  won:       'text-[#22d093] border-[#22d093]/30 bg-[#22d093]/[0.08]',
  lost:      'text-[#6a6a6e] border-white/10 bg-white/[0.03]',
}

interface Props {
  leadId: string
  current: LeadStatus
}

export default function LeadStatusSelect({ leadId, current }: Props) {
  const [pending, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.currentTarget.value as LeadStatus
    startTransition(async () => {
      await updateLeadStatus(leadId, newStatus)
    })
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={pending}
      className={`h-7 pl-2 pr-6 rounded-full text-[11.5px] font-medium border cursor-pointer outline-none
                  appearance-none transition-all disabled:opacity-50
                  ${STATUS_COLORS[current] ?? 'text-[#9a9a9d] border-white/10 bg-white/[0.03]'}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s} className="bg-[#0f1012] text-white">
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  )
}
