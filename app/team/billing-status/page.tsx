import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_BUSINESSES } from '@/lib/data/mock-businesses'

export default async function TeamBillingStatusPage() {
  await requireTeam({ path: '/team/billing-status' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Billing Status</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Subscription health across all paying clients.</p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Plan</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Since</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_BUSINESSES.map((b) => (
              <tr key={b.id} className="border-t border-white/[0.04]">
                <td className="px-5 py-3 text-white">{b.name}</td>
                <td className="px-5 py-3 text-[#9a9a9d] capitalize">{b.plan}</td>
                <td className="px-5 py-3">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#22d093]/40 bg-[#22d093]/[0.10] text-[#22d093]">
                    Active
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-[12px] text-[#6a6a6e]">{new Date(b.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
