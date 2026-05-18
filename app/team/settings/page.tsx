import { requireTeam } from '@/lib/auth/require-team'

export default async function TeamSettingsPage() {
  const session = await requireTeam({ path: '/team/settings' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Team Settings</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Your internal team profile and integration settings.</p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-6 flex flex-col gap-4">
        <Row label="Team member ID" value={session.teamMemberId} mono />
        <Row label="Email"          value={session.email} />
        <Row label="Display name"   value={session.fullName ?? '—'} />
        <Row label="Role"           value={session.role} />
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 py-2 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[12px] uppercase tracking-[0.08em] text-[#6a6a6e]">{label}</span>
      <span className={`text-[14px] text-white ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</span>
    </div>
  )
}
