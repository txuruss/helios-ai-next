'use client'

interface Props {
  search:     string
  onSearch:   (s: string) => void
  page:       number
  totalPages: number
  total:      number
  pageSize:   number
  onPage:     (p: number) => void
  placeholder?: string
}

export default function SearchPaginationBar({
  search, onSearch, page, totalPages, total, pageSize, onPage, placeholder = 'Search…',
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="flex-1 min-w-[180px] relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6a6e] text-[13px]">⌕</span>
        <input
          type="text"
          value={search}
          onChange={(e) => { onSearch(e.target.value); onPage(1) }}
          placeholder={placeholder}
          maxLength={256}
          className="w-full h-9 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08]
                     text-[13px] text-white placeholder-[#6a6a6e] outline-none
                     focus:border-[#ff7a18]/40 transition-colors"
        />
      </div>

      {/* Count */}
      {total > 0 && (
        <span className="text-[11.5px] text-[#6a6a6e] whitespace-nowrap">
          {from}–{to} of {total}
        </span>
      )}
      {total === 0 && search && (
        <span className="text-[11.5px] text-[#6a6a6e]">No results</span>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="h-8 w-8 rounded-lg border border-white/[0.10] text-[#9a9a9d] text-[13px]
                       hover:bg-white/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <span className="px-2 text-[12px] text-[#6a6a6e]">{page} / {totalPages}</span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="h-8 w-8 rounded-lg border border-white/[0.10] text-[#9a9a9d] text-[13px]
                       hover:bg-white/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
