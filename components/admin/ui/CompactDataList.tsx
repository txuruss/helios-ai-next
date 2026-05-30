'use client'

// Responsive key/value list used inside expandable row details.
// Keeps the dark SaaS look: muted uppercase labels, light values.
// `full: true` makes an item span the whole width (good for summaries
// and bullet lists). Pure presentational — no data fetching.

import type { ReactNode } from 'react'

export interface DataItem {
  label: string
  value: ReactNode
  full?: boolean
}

export default function CompactDataList({
  items, columns = 3,
}: {
  items: DataItem[]
  columns?: 2 | 3
}) {
  const colCls = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
  return (
    <dl className={`grid grid-cols-1 ${colCls} gap-x-6 gap-y-3`}>
      {items.map((it, i) => (
        <div
          key={i}
          className={`flex flex-col gap-0.5 ${it.full ? 'sm:col-span-2 lg:col-span-3' : ''}`}
        >
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6a6a6e]">
            {it.label}
          </dt>
          <dd className="text-[12.5px] text-[#cfd3dc] leading-snug break-words">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
