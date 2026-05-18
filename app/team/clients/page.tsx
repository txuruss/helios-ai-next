import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_BUSINESSES } from '@/lib/data/mock-businesses'

export default async function TeamClientsPage() {
  await requireTeam({ path: '/team/clients' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Clients</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">All businesses currently using Helios AI.</p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Industry</th>
              <th className="text-left px-5 py-3">City</th>
              <th className="text-left px-5 py-3">Plan</th>
              <th className="text-right px-5 py-3">Leads (mo)</th>
              <th className="text-right px-5 py-3">Bookings (mo)</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_BUSINESSES.map((b) => (
              <tr key={b.id} className="border-t border-white/[0.04]">
                <td className="px-5 py-3 text-white">{b.name}</td>
                <td className="px-5 py-3 text-[#9a9a9d]">{b.industry}</td>
                <td className="px-5 py-3 text-[#9a9a9d]">{b.city}</td>
                <td className="px-5 py-3 text-[#9a9a9d] capitalize">{b.plan}</td>
                <td className="px-5 py-3 text-right font-mono text-white">{b.monthly_leads}</td>
                <td className="px-5 py-3 text-right font-mono text-white">{b.monthly_bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
