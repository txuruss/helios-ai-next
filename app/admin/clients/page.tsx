import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAdminClients } from '@/lib/data/admin-clients'
import { getClientSuggestionMap } from '@/lib/data/admin-client-suggestions'
import ClientsPageClient from './ClientsPageClient'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Clients — Mission Control' }

export default async function AdminClientsPage() {
  await requireAdmin({ path: '/admin/clients' })

  const [{ rows, error }, suggestions] = await Promise.all([
    getAdminClients(),
    getClientSuggestionMap(),
  ])

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white">Active Clients</h1>
          <span className="text-[9.5px] font-medium uppercase tracking-[0.08em]
                           px-2 py-0.5 rounded-full border border-white/[0.10] bg-white/[0.03] text-[#6a6a6e]">
            Client Ops
          </span>
        </div>
        <p className="text-[13px] text-[#9a9a9d]">
          Founder view of active clients, plan value, lead flow, bookings, and account health.
        </p>
      </header>

      <ClientsPageClient clients={rows} error={error} suggestions={suggestions} />

    </div>
  )
}
