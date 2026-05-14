'use client'

import { useActionState } from 'react'
import { updateProfile } from '@/lib/actions/settings'

const fieldCls =
  'h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white ' +
  'outline-none transition-all focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50 disabled:cursor-not-allowed'

export default function AccountForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, {})

  return (
    <div className="border border-white/10 rounded-2xl p-6">
      <h3 className="text-[16px] font-semibold mb-1">Account</h3>
      <p className="text-[14px] text-[#9a9a9d] mb-5">Manage your personal account details.</p>

      {state.error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13px] text-[#ff8a7a]">{state.error}</div>
      )}
      {state.success && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#22d093]/10 border border-[#22d093]/30 text-[13px] text-[#22d093]">{state.success}</div>
      )}

      <form action={formAction}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block">Full Name</label>
            <input name="full_name" type="text" defaultValue={fullName} required className={fieldCls} disabled={pending} />
          </div>
          <div>
            <label className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block">Email</label>
            <input type="email" value={email} readOnly
              className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.01] px-3.5 text-[14px] text-[#6a6a6e] outline-none cursor-not-allowed" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className="btn-primary btn-sm disabled:opacity-60">
            {pending ? <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" /> Saving…</> : 'Save Account'}
          </button>
        </div>
      </form>
    </div>
  )
}
