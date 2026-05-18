import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_DELIVERY } from '@/lib/data/mock-team'

export default async function TeamDeliveryPage() {
  await requireTeam({ path: '/team/delivery' })

  const stages: Array<['kickoff' | 'build' | 'qa' | 'launch' | 'optimization', string]> = [
    ['kickoff',      'Kickoff'],
    ['build',        'Build'],
    ['qa',           'QA'],
    ['launch',       'Launch'],
    ['optimization', 'Optimization'],
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Delivery Tracker</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Stage-by-stage view of every active project.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {stages.map(([key, label]) => {
          const projects = MOCK_DELIVERY.filter((p) => p.stage === key)
          return (
            <div key={key} className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9a9a9d]">{label}</div>
                <span className="text-[11px] text-[#6a6a6e]">{projects.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {projects.length === 0 ? (
                  <p className="text-[12px] text-[#6a6a6e] italic">No projects</p>
                ) : projects.map((p) => (
                  <div key={p.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[13px] text-white">{p.business}</div>
                    <div className="text-[11px] text-[#6a6a6e] mt-1">Due {p.due_date}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
