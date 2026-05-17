import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PageHeader from '@/components/dashboard/PageHeader'
import AccountForm from './AccountForm'
import PasswordForm from './PasswordForm'
import { getBusinessPlan } from '@/lib/billing/limits'
import { getPlan } from '@/lib/billing/plans'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).single()
    : { data: null }

  // Load plan info for the billing card
  let planId = 'starter'
  if (user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createServiceRoleClient()
    const { data: membership } = await db
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (membership) planId = await getBusinessPlan(db, membership.business_id as string)
  }
  const plan = getPlan(planId)

  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" />

      <div className="flex flex-col gap-6">
        <AccountForm
          fullName={profile?.full_name ?? ''}
          email={user?.email ?? ''}
        />
        <PasswordForm />

        {/* Team */}
        <div className="border border-white/10 rounded-2xl p-6">
          <h3 className="text-[16px] font-semibold mb-1">Team</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Manage team members who have access to your dashboard.</p>
          <div className="border border-dashed border-white/[0.08] rounded-xl p-8 text-center">
            <p className="text-[14px] text-[#6a6a6e] mb-3">Team management available in Phase 3.</p>
            <button className="btn-ghost btn-sm" disabled>Invite Team Member</button>
          </div>
        </div>

        {/* Billing */}
        <div className="border border-white/10 rounded-2xl p-6">
          <h3 className="text-[16px] font-semibold mb-1">Billing</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Manage your subscription plan and usage limits.</p>
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <div className="font-semibold">{plan.displayName ?? plan.name} Plan</div>
              <div className="text-[13px] text-[#9a9a9d] mt-0.5">{plan.monthlyRange} · {plan.limits.ai_conversations_month.toLocaleString()} AI conversations/mo</div>
            </div>
            <Link href="/dashboard/settings/billing" className="btn-primary btn-sm">
              Manage Billing
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
