'use client'

interface OpsFilter {
  id:    string
  label: string
}

interface Props {
  filters:  OpsFilter[]
  active:   string
  onChange: (id: string) => void
}

export default function OpsFilters({ filters, active, onChange }: Props) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {filters.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all
                      ${active === f.id
                        ? 'bg-white/[0.10] text-white'
                        : 'text-[#6a6a6e] hover:text-[#9a9a9d] hover:bg-white/[0.04]'}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
