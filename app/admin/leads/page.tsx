import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_PIPELINE } from '@/lib/data/mock-team'
import LegacyNote from '@/components/admin/LegacyNote'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Leads — Mission Control' }

const STAGE_TONE: Record<string, string> = {
  new: '#6a6a6e', qualified: '#3b9eff', audit_sent: '#ffae3c',
  proposal: '#ff7a18', won: '#22d093', lost: '#ff8a7a',
}

export default async function AdminLeadsPage() {
  await requireAdmin({ path: '/admin/leads' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Leads</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Founder view of every inbound and outbound lead across stages.
        </p>
      </div>

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
              const color = STAGE_TONE[d.stage]
              return (
                <tr key={d.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3 text-white">{d.business}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{d.contact}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize"
                      style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                      {d.stage.replaceAll('_', ' ')}
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

      <LegacyNote href="/dashboard/leads" label="Open legacy leads CRM" />
    </div>
  )
}
