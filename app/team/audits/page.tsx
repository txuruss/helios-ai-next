import { requireTeam } from '@/lib/auth/require-team'
import { MOCK_BUSINESSES } from '@/lib/data/mock-businesses'

const STATUS_TONE: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: '#ffae3c' },
  in_review: { label: 'In Review', color: '#3b9eff' },
  sent:      { label: 'Sent',      color: '#22d093' },
  declined:  { label: 'Declined',  color: '#ff8a7a' },
}

export default async function TeamAuditsPage() {
  await requireTeam({ path: '/team/audits' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Audits</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Business audits requested from the public registration flow. Approve, edit, or send recommendations.
        </p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Industry</th>
              <th className="text-left px-5 py-3">City</th>
              <th className="text-left px-5 py-3">Plan</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Score</th>
              <th className="text-right px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_BUSINESSES.map((b) => {
              const tone = STATUS_TONE[b.audit_status]
              return (
                <tr key={b.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3 text-white">{b.name}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{b.industry}</td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{b.city}</td>
                  <td className="px-5 py-3 text-[#9a9a9d] capitalize">{b.plan}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
                      style={{ color: tone.color, borderColor: `${tone.color}40`, background: `${tone.color}12` }}>
                      {tone.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-white">{b.audit_score ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-[12px] text-[#6a6a6e]">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
