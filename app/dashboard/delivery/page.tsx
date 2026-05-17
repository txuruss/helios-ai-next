import { Metadata } from 'next'
import PageHeader from '@/components/dashboard/PageHeader'
import { getDeliveryTasks } from '@/lib/actions/delivery'
import DeliveryProgressSummary from './DeliveryProgressSummary'
import DeliveryPipelineClient from './DeliveryPipelineClient'

export const metadata: Metadata = { title: 'Delivery Pipeline — Helios AI' }

export default async function DeliveryPage() {
  const { tasks, progress, error } = await getDeliveryTasks()

  return (
    <>
      <PageHeader
        eyebrow="Client Setup"
        title="Delivery Pipeline"
        description="Track every task required to set up and launch a client's AI booking system."
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-[#ff8a7a]/20 bg-[#ff8a7a]/[0.06] text-[13px] text-[#ff8a7a]">
          {error}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="border border-white/[0.07] rounded-2xl p-12 text-center bg-[#0f1012]">
          <div className="text-[36px] mb-4">📋</div>
          <h3 className="text-[18px] font-semibold text-white mb-2">No delivery tasks yet</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">
            Submit the onboarding intake to automatically create your delivery pipeline.
          </p>
          <a href="/dashboard/onboarding"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] text-[13.5px] font-medium bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] hover:opacity-90 transition-opacity">
            Go to Onboarding →
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <DeliveryProgressSummary progress={progress} />
          <DeliveryPipelineClient initialTasks={tasks} />
        </div>
      )}
    </>
  )
}
