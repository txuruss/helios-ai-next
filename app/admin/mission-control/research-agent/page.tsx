import Link from 'next/link'
import { ArrowLeft, Telescope } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { googleMapsConfigured } from '@/lib/research/googlePlaces'
import { getResearchRuns } from '@/lib/data/admin-research'
import ResearchAgentClient from '@/components/admin/research-agent/ResearchAgentClient'

export const metadata = { title: 'Research Agent — Mission Control' }

export default async function ResearchAgentPage() {
  await requireAdmin({ path: '/admin/mission-control/research-agent' })

  const apiKeyMissing = !googleMapsConfigured()
  const { rows, migrationNeeded } = await getResearchRuns(15)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-1.5">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white flex items-center gap-2">
            <Telescope size={20} className="text-[#ff7a18]" /> Business Research Agent
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                           px-2.5 py-1 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.07] text-[#ffae3c]">
            Google Places · rule-scored
          </span>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Search local service businesses, score them for Helios AI fit, and save qualified leads.
        </p>
      </header>

      <ResearchAgentClient
        apiKeyMissing={apiKeyMissing}
        migrationNeeded={migrationNeeded}
        initialRuns={rows}
      />
    </div>
  )
}
