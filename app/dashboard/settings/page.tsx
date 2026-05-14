import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id ?? '').single()

  return (
    <>
      <PageHeader eyebrow="Settings" title="Settings" />

      <div className="flex flex-col gap-6">
        {/* Account */}
        <div className="border border-white/10 rounded-2xl p-6">
          <h3 className="text-[16px] font-semibold mb-1">Account</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Manage your personal account details.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block">Full Name</label>
              <input type="text" defaultValue={profile?.full_name ?? ''}
                className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                           outline-none focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] transition-all" />
            </div>
            <div>
              <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block">Email</label>
              <input type="email" defaultValue={user?.email ?? ''} readOnly
                className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.01] px-3.5 text-[14px]
                           text-[#6a6a6e] outline-none cursor-not-allowed" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn-primary btn-sm">Save Account</button>
          </div>
        </div>

        {/* Security */}
        <div className="border border-white/10 rounded-2xl p-6">
          <h3 className="text-[16px] font-semibold mb-1">Security</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Manage your password and session security.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block">New Password</label>
              <input type="password" placeholder="••••••••"
                className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                           outline-none focus:border-[#ff7a18]/50 transition-all" />
            </div>
            <div>
              <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block">Confirm Password</label>
              <input type="password" placeholder="••••••••"
                className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                           outline-none focus:border-[#ff7a18]/50 transition-all" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn-ghost btn-sm">Update Password</button>
          </div>
        </div>

        {/* Team */}
        <div className="border border-white/10 rounded-2xl p-6">
          <h3 className="text-[16px] font-semibold mb-1">Team</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Manage team members who have access to your dashboard.</p>
          <div className="border border-dashed border-white/[0.08] rounded-xl p-8 text-center">
            <p className="text-[14px] text-[#6a6a6e] mb-3">Team management is available in Phase 2.</p>
            <button className="btn-ghost btn-sm" disabled>Invite Team Member</button>
          </div>
        </div>

        {/* Billing */}
        <div className="border border-white/10 rounded-2xl p-6">
          <h3 className="text-[16px] font-semibold mb-1">Billing</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Manage your subscription plan and billing.</p>
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <div className="font-semibold">Free Trial</div>
              <div className="text-[13px] text-[#9a9a9d] mt-0.5">Phase 2: Connect Stripe to manage subscriptions</div>
            </div>
            <button className="btn-primary btn-sm" disabled>Upgrade Plan</button>
          </div>
          <div className="mt-4 p-4 rounded-xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-1">Phase 2 — Stripe</div>
            <p className="text-[13px] text-[#9a9a9d]">
              Add <code className="font-mono text-[#5be3c5]">STRIPE_SECRET_KEY</code> and{' '}
              <code className="font-mono text-[#5be3c5]">STRIPE_WEBHOOK_SECRET</code> to enable billing.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
