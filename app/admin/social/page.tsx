import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { MOCK_ADMIN_SOCIAL } from '@/lib/data/mock-admin'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Social — Mission Control' }

const STATUS_TONE: Record<string, string> = {
  draft: '#6a6a6e', scheduled: '#3b9eff', posted: '#22d093',
}

export default async function AdminSocialPage() {
  await requireAdmin({ path: '/admin/social' })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/mission-control" className="text-[12px] text-[#6a6a6e] hover:text-white flex items-center gap-1.5 mb-1">
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <h1 className="text-[22px] font-semibold">Social</h1>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Founder posting schedule across LinkedIn, Instagram, TikTok, X, and YouTube.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.08em] text-[#6a6a6e]">
            <tr>
              <th className="text-left px-5 py-3">Channel</th>
              <th className="text-left px-5 py-3">Caption</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ADMIN_SOCIAL.map((s) => {
              const color = STATUS_TONE[s.status]
              return (
                <tr key={s.id} className="border-t border-white/[0.04]">
                  <td className="px-5 py-3 text-[#9a9a9d] capitalize">{s.channel}</td>
                  <td className="px-5 py-3 text-white">{s.caption}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize"
                      style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-[12px] text-[#6a6a6e]">
                    {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
