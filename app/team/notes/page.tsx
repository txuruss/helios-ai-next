import { requireTeam } from '@/lib/auth/require-team'

export default async function TeamNotesPage() {
  await requireTeam({ path: '/team/notes' })
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Notes</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Internal notes about clients, prospects, and ongoing projects.</p>
      </header>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 p-10 text-center">
        <p className="text-[14px] text-[#9a9a9d]">Internal notes will appear here.</p>
      </div>
    </div>
  )
}
