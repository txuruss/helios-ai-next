'use client'

import { useState, useEffect } from 'react'
import type { NicheTemplate } from '@/lib/templates/niche-templates'
import type { TemplateApplicationLog } from '@/lib/actions/templates'
import TemplateCard                  from './TemplateCard'
import TemplatePreviewDrawer         from './TemplatePreviewDrawer'
import TemplateApplicationHistory    from './TemplateApplicationHistory'
import { capture }                   from '@/lib/analytics/posthog'

interface Props {
  templates:       NicheTemplate[]
  initialHistory:  TemplateApplicationLog[]
}

export default function TemplatesClient({ templates, initialHistory }: Props) {
  const [history,    setHistory]    = useState(initialHistory)
  const [activePreview, setActivePreview] = useState<NicheTemplate | null>(null)
  const [applyTarget,   setApplyTarget]   = useState<NicheTemplate | null>(null)
  const [search,     setSearch]     = useState('')

  useEffect(() => {
    capture('templates_page_viewed', {})
  }, [])

  const filtered = templates.filter((t) =>
    search.trim() === '' ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.businessType.toLowerCase().includes(search.toLowerCase()) ||
    t.idealFor.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  )

  const handleApplied = async () => {
    // Reload history after apply
    const { getTemplateApplicationHistory } = await import('@/lib/actions/templates')
    const { history: newHistory } = await getTemplateApplicationHistory()
    setHistory(newHistory)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by business type, niche, or keyword…"
        className="h-10 w-full max-w-md rounded-lg bg-white/[0.04] border border-white/[0.08] px-4 text-[13.5px]
                   text-white placeholder-[#6a6a6e] outline-none focus:border-[#ff7a18]/40 transition-colors"
      />

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="border border-white/[0.07] rounded-2xl p-8 text-center bg-[#0f1012]">
          <p className="text-[13px] text-[#6a6a6e]">No templates match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t.key}
              template={t}
              onPreview={() => setActivePreview(t)}
              onApply={() => setApplyTarget(t)}
            />
          ))}
        </div>
      )}

      {/* Application history */}
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-3">Application History</p>
        <TemplateApplicationHistory history={history} />
      </div>

      {/* Preview drawer */}
      {activePreview && (
        <TemplatePreviewDrawer
          template={activePreview}
          onClose={() => setActivePreview(null)}
          onApplied={handleApplied}
        />
      )}

      {/* Apply shortcut — goes straight to drawer with apply intent */}
      {applyTarget && !activePreview && (
        <TemplatePreviewDrawer
          template={applyTarget}
          onClose={() => setApplyTarget(null)}
          onApplied={handleApplied}
        />
      )}
    </div>
  )
}
