'use client'

export type BookingFilter =
  | 'all'
  | 'pending'
  | 'customer_confirmed'
  | 'owner_confirmed'
  | 'confirmed'
  | 'rejected'
  | 'expired'
  | 'needs_review'
  | 'availability_failed'

const FILTERS: { value: BookingFilter; label: string }[] = [
  { value: 'all',                label: 'All'                 },
  { value: 'pending',            label: '⏳ Pending'          },
  { value: 'customer_confirmed', label: '✓ Customer'         },
  { value: 'owner_confirmed',    label: '✓ Owner'            },
  { value: 'confirmed',          label: '✅ Confirmed'       },
  { value: 'rejected',           label: '✗ Rejected'         },
  { value: 'expired',            label: '⏱ Expired'          },
  { value: 'needs_review',       label: '⚠ Needs Review'     },
  { value: 'availability_failed',label: '⚠ Avail. Failed'    },
]

interface Props {
  active:   BookingFilter
  onChange: (f: BookingFilter) => void
  search:   string
  onSearch: (s: string) => void
}

export default function BookingsFilterBar({ active, onChange, search, onSearch }: Props) {
  return (
    <div className="flex flex-col gap-3 mb-5">
      {/* Search */}
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by customer name or service…"
        className="h-9 w-full max-w-sm rounded-lg bg-white/[0.04] border border-white/[0.08] px-3
                   text-[13px] text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors"
      />

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={`h-7 px-3 rounded-full text-[11.5px] transition-all ${
              active === f.value
                ? 'bg-[#ff7a18]/[0.15] border border-[#ff7a18]/30 text-[#ffae3c]'
                : 'border border-white/[0.08] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
