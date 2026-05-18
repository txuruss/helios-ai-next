import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_DELIVERY } from '@/lib/data/mock-team'

export default async function TeamProjectsPage() {
  await requireTeam({ path: '/team/projects' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Projects</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">All client delivery projects and progress.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MOCK_DELIVERY.map((p) => (
          <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px] font-semibold">{p.business}</div>
                <div className="text-[12px] text-[#6a6a6e] capitalize">Stage: {p.stage}</div>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c]">
                {p.progress}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#ff7a18] to-[#ffae3c]" style={{ width: `${p.progress}%` }} />
            </div>
            <div className="flex justify-between text-[12px] text-[#9a9a9d]">
              <span>Owner: {p.owner}</span>
              <span>Due {p.due_date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
