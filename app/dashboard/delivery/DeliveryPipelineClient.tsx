'use client'

import { useState, useTransition } from 'react'
import DeliveryTaskCard from './DeliveryTaskCard'
import DeliveryProgressSummary from './DeliveryProgressSummary'
import { approveDeliveryLaunch } from '@/lib/actions/delivery'
import type { DeliveryTask, DeliveryProgress } from '@/lib/actions/delivery'
import type { DeliveryTaskStatus, DeliveryCategory } from '@/lib/validation/delivery'
import { DELIVERY_CATEGORIES } from '@/lib/validation/delivery'
import { capture } from '@/lib/analytics/posthog'

const CATEGORY_LABEL: Record<DeliveryCategory, string> = {
  intake: 'Intake', services: 'Services', faqs: 'FAQs', booking: 'Booking',
  whatsapp: 'WhatsApp', calcom: 'Cal.com', widget: 'Widget',
  qa: 'QA Testing', launch: 'Launch', handoff: 'Handoff',
}

function computeProgress(tasks: Pick<DeliveryTask, 'status'>[]): DeliveryProgress {
  const total       = tasks.length
  const completed   = tasks.filter((t) => t.status === 'completed').length
  const blocked     = tasks.filter((t) => t.status === 'blocked').length
  const in_progress = tasks.filter((t) => t.status === 'in_progress').length
  const pending     = tasks.filter((t) => t.status === 'pending').length
  const skipped     = tasks.filter((t) => t.status === 'skipped').length
  const done        = completed + skipped
  const percent     = total > 0 ? Math.round((done / total) * 100) : 0
  const launchReady = total > 0 && blocked === 0 && percent >= 80
  return { total, completed, blocked, in_progress, pending, skipped, percent, launchReady }
}

interface Props { initialTasks: DeliveryTask[] }

export default function DeliveryPipelineClient({ initialTasks }: Props) {
  const [tasks,     setTasks]      = useState(initialTasks)
  const [filter,    setFilter]     = useState<DeliveryCategory | 'all'>('all')
  const [launchMsg, setLaunchMsg]  = useState<string | null>(null)
  const [error,     setError]      = useState<string | null>(null)
  const [launching, startLaunch]   = useTransition()

  const progress = computeProgress(tasks)

  const handleUpdated = (id: string, status: DeliveryTaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === id ? {
      ...t, status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      blocked_reason: status !== 'blocked' ? null : t.blocked_reason,
    } : t))
    capture(`delivery_task_${status}`, { task_id: id.slice(0, 8) })
  }

  const handleLaunch = () => {
    setError(null)
    startLaunch(async () => {
      const result = await approveDeliveryLaunch()
      if (result.error) { setError(result.error); return }
      setLaunchMsg(result.success ?? 'Launch approved!')
      capture('launch_approved', { source: 'delivery_pipeline' })
    })
  }

  const filtered = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.category === filter)

  const grouped = DELIVERY_CATEGORIES.reduce<Record<string, DeliveryTask[]>>((acc, cat) => {
    const catTasks = (filter === 'all' ? tasks : filtered).filter((t) => t.category === cat)
    if (catTasks.length > 0) acc[cat] = catTasks
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-5">
      {error    && <p className="text-[12.5px] text-[#ff8a7a]">{error}</p>}
      {launchMsg && <p className="text-[12.5px] text-[#22d093]">{launchMsg}</p>}

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilter('all')}
          className={`h-7 px-3 rounded-full text-[11.5px] transition-all ${
            filter === 'all' ? 'bg-[#ff7a18]/[0.15] border border-[#ff7a18]/30 text-[#ffae3c]' : 'border border-white/[0.08] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white'
          }`}>
          All ({tasks.length})
        </button>
        {DELIVERY_CATEGORIES.map((cat) => {
          const count = tasks.filter((t) => t.category === cat).length
          if (count === 0) return null
          return (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`h-7 px-3 rounded-full text-[11.5px] transition-all ${
                filter === cat ? 'bg-[#ff7a18]/[0.15] border border-[#ff7a18]/30 text-[#ffae3c]' : 'border border-white/[0.08] text-[#9a9a9d] hover:bg-white/[0.04] hover:text-white'
              }`}>
              {CATEGORY_LABEL[cat]} ({count})
            </button>
          )
        })}
      </div>

      {/* Task groups */}
      {Object.entries(grouped).map(([cat, catTasks]) => (
        <div key={cat}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-2.5">
            {CATEGORY_LABEL[cat as DeliveryCategory]}
          </p>
          <div className="flex flex-col gap-2">
            {catTasks.map((task) => (
              <DeliveryTaskCard key={task.id} task={task} onUpdated={handleUpdated} />
            ))}
          </div>
        </div>
      ))}

      {/* Launch approval */}
      {progress.launchReady && !launchMsg && (
        <div className="border border-[#22d093]/25 rounded-2xl p-5 bg-[#22d093]/[0.04]">
          <p className="text-[14px] font-semibold text-white mb-1">Ready to Launch</p>
          <p className="text-[12.5px] text-[#9a9a9d] mb-4">
            All required tasks are complete or skipped. Approve to mark the client system as live.
          </p>
          <button onClick={handleLaunch} disabled={launching}
            className="h-10 px-6 rounded-xl text-[13.5px] font-medium bg-gradient-to-b from-[#22d093] to-[#19a572] text-[#001a0f] hover:opacity-90 transition-opacity disabled:opacity-40">
            {launching ? 'Approving…' : '🚀 Approve Launch'}
          </button>
        </div>
      )}
    </div>
  )
}
