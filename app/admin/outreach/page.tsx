import Link from 'next/link'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getAdminOutreachLeads, getOutreachDailyReview } from '@/lib/data/admin-outreach'
import type { AdminOutreachLead } from '@/lib/data/admin-outreach'
import { getResearchLeadById, type SavedResearchLead } from '@/lib/data/admin-research'
import OutreachPageClient from './OutreachPageClient'

export const metadata = { title: 'Outreach — Mission Control' }

// Map a saved research lead → an outreach Add-lead prefill. The research
// lead's score is 0–100; outreach scores 0–10, so it is scaled. first_dm /
// cold_email_opening have no dedicated outreach fields, so they (and the
// source + research lead id) are preserved in notes. No schema change.
function toOutreachPrefill(rl: SavedResearchLead): Partial<AdminOutreachLead> {
  const contactMethod: AdminOutreachLead['contact_method'] =
    rl.phone ? 'phone' : rl.website ? 'website' : 'instagram'
  const score10 = rl.lead_score !== null
    ? Math.max(0, Math.min(10, Math.round(rl.lead_score / 10)))
    : 0

  const notes: string[] = [`From Research Agent (lead ${rl.id}).`]
  if (rl.google_maps_url)    notes.push(`Google Maps: ${rl.google_maps_url}`)
  if (rl.first_dm)           notes.push(`\nSuggested first DM:\n${rl.first_dm}`)
  if (rl.cold_email_opening) notes.push(`\nCold email opening:\n${rl.cold_email_opening}`)

  return {
    business_name:  rl.business_name,
    niche:          rl.niche ?? '',
    location:       rl.address ?? '',
    website_url:    rl.website ?? '',
    phone:          rl.phone ?? '',
    email:          '',
    instagram_url:  '',
    contact_method: contactMethod,
    score:          score10,
    pain_found:     rl.problem_found ?? '',
    outreach_angle: rl.outreach_angle ?? '',
    reply_status:   'new',
    next_action:    'Send first message / call',
    follow_up_date: null,
    notes:          notes.join('\n'),
  }
}

export default async function AdminOutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ prefillResearchLeadId?: string }>
}) {
  await requireAdmin({ path: '/admin/outreach' })

  const { prefillResearchLeadId } = await searchParams

  const today = new Date().toISOString().slice(0, 10)
  const [{ rows, migrationNeeded, error }, review] = await Promise.all([
    getAdminOutreachLeads(),
    getOutreachDailyReview(today),
  ])

  // Prefill from the Research Agent's "Ready for Outreach" action.
  let prefill: Partial<AdminOutreachLead> | null = null
  if (prefillResearchLeadId) {
    const rl = await getResearchLeadById(prefillResearchLeadId)
    if (rl) prefill = toOutreachPrefill(rl)
  }

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
            <Megaphone size={20} className="text-[#ff7a18]" /> Client Outreach
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                           px-2.5 py-1 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.07] text-[#ffae3c]">
            Manual outreach
          </span>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Find, score, contact, and follow up with local service businesses.
        </p>
      </header>

      {migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          Outreach tracking is unavailable until migration{' '}
          <code className="font-mono text-[11.5px]">20260605120000_create_admin_outreach.sql</code> is applied in Supabase.
          The dashboard, scripts, and follow-up tools below still work — leads just won&apos;t save yet.
        </div>
      )}
      {error && !migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          {error}
        </div>
      )}

      <OutreachPageClient leads={rows} initialReview={review} reviewDate={today} initialPrefill={prefill} />
    </div>
  )
}
