'use client'

import { useActionState, useState } from 'react'
import { login } from '@/lib/auth/actions'
import type { ActionState } from '@/types'

const INITIAL: ActionState = {}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'This account does not have team access. Contact a founder admin.',
}

export default function TeamLoginForm({ redirectTo, authError }: { redirectTo?: string; authError?: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL)
  const [showPass, setShowPass] = useState(false)

  const displayError = state.error ?? (authError ? AUTH_ERROR_MESSAGES[authError] ?? 'Authentication error.' : undefined)

  return (
    <div className="w-full rounded-3xl border border-white/10 p-9
                    bg-gradient-to-b from-[#141518]/90 to-[#0a0b0d]/90
                    backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_40px_80px_rgba(0,0,0,0.6)]
                    flex flex-col gap-6">

      <div className="flex items-center justify-center gap-2.5 font-semibold text-[16px]">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-[#0a0a0c] bg-center bg-contain bg-no-repeat shrink-0"
              style={{ backgroundImage: 'url(/assets/helios-logo.png)', boxShadow: '0 0 20px rgba(255,122,24,0.45)' }} />
        Helios AI · Team
      </div>

      <div className="text-center flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold">Internal Team Sign In</h1>
        <p className="text-[14px] text-[#9a9a9d]">For Helios AI staff only.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? '/team/dashboard'} />

        {displayError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl
                          bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13.5px] text-[#ff8a7a]">
            {displayError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">
            Helios Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" autoFocus required
            placeholder="you@helios.ai"
            className="h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                       placeholder:text-[#6a6a6e] outline-none transition-all
                       focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04]" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">
            Password
          </label>
          <div className="relative">
            <input id="password" name="password" type={showPass ? 'text' : 'password'}
              autoComplete="current-password" required
              className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 pr-12 text-[14px] text-white
                         placeholder:text-[#6a6a6e] outline-none transition-all
                         focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04]" />
            <button type="button" tabIndex={-1} onClick={() => setShowPass((s) => !s)}
              className="absolute right-0 top-0 h-full w-12 flex items-center justify-center
                         text-[#6a6a6e] hover:text-[#9a9a9d] transition-colors"
              aria-label={showPass ? 'Hide password' : 'Show password'}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full h-[50px] text-[15px] justify-center">
          {pending ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="pt-4 border-t border-white/[0.06] text-[11.5px] text-[#6a6a6e] flex items-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5 11-12"/></svg>
        Secured via Supabase Auth · Internal use only
      </div>
    </div>
  )
}
