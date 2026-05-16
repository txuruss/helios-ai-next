'use client'

import { useState, useTransition } from 'react'
import { updateApprovalItemStatus } from '@/lib/actions/ops'
import type { ApprovalItem } from '@/lib/actions/ops'
import { capture } from '@/lib/analytics/posthog'

interface Props { items: ApprovalItem[]; onRefresh: () => void }

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-[#ffae3c]/10 text-[#ffae3c]',
  approved: 'bg-[#22d093]/10 text-[#22d093]',
  rejected: 'bg-[#ff8a7a]/10 text-[#ff8a7a]',
  expired:  'bg-white/[0.06] text-[#6a6a6e]',
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function ApprovalQueue({ items, onRefresh }: Props) {
  const [filter, setFilter]  = useState('pending')
  const [pending, startTransition] = useTransition()

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  const decide = (id: string, status: 'approved' | 'rejected') => {
    startTransition(async () => {
      await updateApprovalItemStatus(id, status)
      capture(status === 'approved' ? 'approval_item_approved' : 'approval_item_rejected', {})
      onRefresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-medium transition-all capitalize
                        ${filter === f ? 'bg-white/[0.10] text-white' : 'text-[#6a6a6e] hover:text-[#9a9a9d]'}`}>
            {f}
            {f === 'pending' && items.filter((i) => i.status === 'pending').length > 0 && (
              <span className="ml-1 text-[10px] px-1 rounded-full bg-[#ffae3c]/20 text-[#ffae3c]">
                {items.filter((i) => i.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-white/[0.07] bg-[#0f1012]">
          <span className="text-[24px]">✅</span>
          <p className="text-[13px] font-medium text-white">No approvals</p>
          <p className="text-[12px] text-[#6a6a6e]">No pending approvals right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-white">{item.title}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[item.status] ?? STATUS_BADGE.pending}`}>
                      {item.status}
                    </span>
                  </div>
                  {item.description && <p className="text-[12px] text-[#9a9a9d] mt-1">{item.description}</p>}
                  <p className="text-[10.5px] text-[#6a6a6e] mt-1 capitalize">
                    {item.approval_type}
                    {item.requested_by ? ` · by ${item.requested_by}` : ''}
                    {` · ${relTime(item.created_at)}`}
                  </p>
                </div>
              </div>
              {item.content && (
                <pre className="text-[11px] text-[#9a9a9d] bg-white/[0.02] rounded-lg px-3 py-2 overflow-x-auto font-mono whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                  {item.content.slice(0, 500)}{item.content.length > 500 ? '…' : ''}
                </pre>
              )}
              {item.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => decide(item.id, 'approved')} disabled={pending}
                    className="h-8 px-4 rounded-lg bg-[#22d093]/12 border border-[#22d093]/30 text-[#22d093]
                               text-[12px] font-medium hover:bg-[#22d093]/20 transition-all disabled:opacity-40">
                    Approve
                  </button>
                  <button onClick={() => decide(item.id, 'rejected')} disabled={pending}
                    className="h-8 px-4 rounded-lg bg-[#ff8a7a]/[0.08] border border-[#ff8a7a]/20 text-[#ff8a7a]
                               text-[12px] font-medium hover:bg-[#ff8a7a]/15 transition-all disabled:opacity-40">
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
