import { requireTeam } from '@/lib/auth/require-team'

const TASKS = [
  { id: 't1', title: 'Send audit recap to Atlas Auto Repairs', owner: 'Sales Lead',     due: 'Today',     priority: 'high'   },
  { id: 't2', title: 'Approve WhatsApp template for Sunrise',  owner: 'Delivery Lead',  due: 'Tomorrow',  priority: 'medium' },
  { id: 't3', title: 'Review monthly insight emails for May',  owner: 'Ops Analyst',    due: 'May 22',    priority: 'low'    },
]

const PRIORITY_TONE: Record<string, string> = {
  high:   '#ff8a7a',
  medium: '#ffae3c',
  low:    '#22d093',
}

export default async function TeamTasksPage() {
  await requireTeam({ path: '/team/tasks' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold">Tasks</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">Outstanding work across the team.</p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <div className="divide-y divide-white/[0.04]">
          {TASKS.map((t) => {
            const color = PRIORITY_TONE[t.priority]
            return (
              <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <input type="checkbox" className="w-4 h-4 rounded border-white/15 bg-transparent" readOnly />
                  <div className="min-w-0">
                    <div className="text-[14px] text-white">{t.title}</div>
                    <div className="text-[12px] text-[#6a6a6e]">Owner: {t.owner} · Due {t.due}</div>
                  </div>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize"
                  style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                  {t.priority}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
