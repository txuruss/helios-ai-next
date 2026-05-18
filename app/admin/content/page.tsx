import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_ADMIN_CONTENT } from '@/lib/data/mock-admin'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Content — Mission Control' }

const STAGE_TONE: Record<string, string> = {
  brief: '#6a6a6e', draft: '#9a9a9d', review: '#ffae3c', scheduled: '#3b9eff', published: '#22d093',
}

export default async function AdminContentPage() {
  await requireAdmin({ path: '/admin/content' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Content</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Pipeline of marketing content: blog posts, case studies, guides, and newsletters.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Title</th>
              <th className="text-left px-5 py-3">Channel</th>
              <th className="text-left px-5 py-3">Stage</th>
              <th className="text-left px-5 py-3">Owner</th>
              <th className="text-right px-5 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ADMIN_CONTENT.map((c) => {
              const color = STAGE_TONE[c.stage]
              return (
                <tr key={c.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3 text-white">{c.title}</td>
                  <td className="px-5 py-3 text-[#9a9a9d] capitalize">{c.channel.replaceAll('_', ' ')}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize"
                      style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                      {c.stage}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#9a9a9d]">{c.owner}</td>
                  <td className="px-5 py-3 text-right text-[12px] text-[#6a6a6e]">{c.due_date ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
