import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_PIPELINE } from '@/lib/data/mock-team'

const STAGE_LABEL = {
  new:         { label: 'New',         color: '#6a6a6e' },
  qualified:   { label: 'Qualified',   color: '#3b9eff' },
  audit_sent:  { label: 'Audit Sent',  color: '#ffae3c' },
  proposal:    { label: 'Proposal',    color: '#ff7a18' },
  won:         { label: 'Won',         color: '#22d093' },
  lost:        { label: 'Lost',        color: '#ff8a7a' },
} as const

export default async function TeamPipelinePage() {
  await requireTeam({ path: '/team/pipeline' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Pipeline</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Active deals across all sales stages.</p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Contact</th>
              <th className="text-left px-5 py-3">Stage</th>
              <th className="text-left px-5 py-3">Target Plan</th>
              <th className="text-right px-5 py-3">Value</th>
              <th className="text-left px-5 py-3">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PIPELINE.map((d) => {
              const stage = STAGE_LABEL[d.stage]
              return (
                <tr key={d.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3 text-white">{d.business}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{d.contact}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
                      style={{ color: stage.color, borderColor: `${stage.color}40`, background: `${stage.color}12` }}>
                      {stage.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#9a9a9d] capitalize">{d.plan_target}</td>
                  <td className="px-5 py-3 text-right font-mono text-white">${d.value_usd.toLocaleString()}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{d.next_action}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
