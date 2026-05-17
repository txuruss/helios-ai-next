import { Metadata } from 'next'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PageHeader from '@/components/dashboard/PageHeader'
import { getSetupProgress, getAiPaused } from '@/lib/actions/setup'
import { SETUP_ITEM_KEYS, SETUP_ITEM_LABELS, computeSetupPercent } from '@/lib/validation/setup'
import SetupChecklistClient from './SetupChecklistClient'
import DemoQaChecklist from './DemoQaChecklist'

export const metadata: Metadata = { title: 'Setup Guide — Helios AI' }

export default async function SetupPage() {
  const [setupResult, aiResult] = await Promise.all([
    getSetupProgress(),
    getAiPaused(),
  ])

  const progress = setupResult.progress
  const percent  = computeSetupPercent(progress as Record<string, unknown> | null)

  return (
    <>
      <PageHeader
        eyebrow="Setup Guide"
        title="Get Your Business Ready"
        description="Complete each step to fully launch your Helios AI system. You can update these as you go."
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Progress summary */}
        <div className="lg:col-span-1">
          <div className="border border-white/[0.07] rounded-2xl p-5 bg-[#0f1012] sticky top-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-3">Your Progress</p>

            {/* Ring */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={percent === 100 ? '#22d093' : '#ffae3c'} strokeWidth="3"
                    strokeDasharray={`${percent} ${100 - percent}`}
                    strokeDashoffset="0" strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.7s ease' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[14px] font-semibold text-white">
                  {percent}%
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-white">
                  {progress ? SETUP_ITEM_KEYS.filter((k) => progress[k]).length : 0} / {SETUP_ITEM_KEYS.length} done
                </p>
                <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">
                  {percent === 100 ? 'All steps complete!' : 'Keep going — you\'re making progress.'}
                </p>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Business Profile', href: '/dashboard/business' },
                { label: 'Services & FAQs',  href: '/dashboard/services' },
                { label: 'Cal.com Setup',    href: '/dashboard/calcom'   },
                { label: 'WhatsApp Setup',   href: '/dashboard/whatsapp' },
                { label: 'Widget Install',   href: '/dashboard/widget'   },
                { label: 'Ops Center',       href: '/dashboard/ops'      },
              ].map((l) => (
                <Link key={l.href} href={l.href}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-[12.5px] text-[#9a9a9d]
                             hover:bg-white/[0.04] hover:text-white transition-all">
                  {l.label}
                  <span className="text-[#6a6a6e]">→</span>
                </Link>
              ))}
            </div>

            {/* AI pause status */}
            {!aiResult.error && (
              <div className={`mt-4 px-3 py-2.5 rounded-xl border text-[12px] ${
                aiResult.paused
                  ? 'border-[#ffae3c]/30 bg-[#ffae3c]/[0.06] text-[#ffae3c]'
                  : 'border-[#22d093]/20 bg-[#22d093]/[0.04] text-[#22d093]'
              }`}>
                {aiResult.paused ? '⏸ AI is paused' : '✓ AI is active'}
                {aiResult.paused && aiResult.reason && (
                  <p className="text-[10.5px] text-[#9a9a9d] mt-0.5">{aiResult.reason}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Checklist + QA */}
        <div className="lg:col-span-2">
          <SetupChecklistClient initialProgress={progress} initialAiPaused={aiResult.paused} />
          <DemoQaChecklist />
        </div>
      </div>
    </>
  )
}
