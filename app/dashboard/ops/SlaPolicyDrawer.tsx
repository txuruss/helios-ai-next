'use client'

import type { SlaPolicy } from '@/lib/actions/ops'
import SlaPolicyForm from './SlaPolicyForm'

interface Props {
  policy?:  SlaPolicy | null
  onClose:  () => void
  onSaved:  () => void
}

export default function SlaPolicyDrawer({ policy, onClose, onSaved }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 w-[480px] max-w-[100vw] z-50
                        bg-[#0c0d0f] border-l border-white/[0.06] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <h2 className="text-[15px] font-semibold text-white">
            {policy ? 'Edit SLA Policy' : 'Create SLA Policy'}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#6a6a6e] hover:text-white transition-colors text-[16px]">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <SlaPolicyForm policy={policy} onClose={onClose} onSaved={onSaved} />
        </div>
      </aside>
    </>
  )
}
