'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { signup } from '@/lib/auth/actions'
import type { ActionState } from '@/types'

const INITIAL: ActionState = {}

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, INITIAL)
  const [showPass, setShowPass] = useState(false)

  if (state.success) {
    return (
      <div className="w-full rounded-3xl border border-[#22d093]/35 p-9
                      bg-gradient-to-b from-[#22d093]/10 to-[#0f1012]/60 text-center
                      flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[#22d093]/18 border border-[#22d093]/40
                        flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="m4 12 5 5 11-12"/>
          </svg>
        </div>
        <h2 className="text-[24px] font-semibold">Account created!</h2>
        <p className="text-[14.5px] text-[#9a9a9d] max-w-[360px]">{state.success}</p>
        <Link href="/login" className="btn-primary mt-2">Sign In Now</Link>
      </div>
    )
  }

  return (
    <div className="w-full rounded-3xl border border-white/10 p-9
                    bg-gradient-to-b from-[#141518]/90 to-[#0a0b0d]/90
                    backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_40px_80px_rgba(0,0,0,0.6),0_0_120px_-40px_rgba(255,122,24,0.2)]
                    flex flex-col gap-6">

      {/* Brand */}
      <div className="flex items-center justify-center gap-2.5 font-semibold text-[16px]">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-[#0a0a0c] bg-center bg-contain bg-no-repeat shrink-0"
              style={{ backgroundImage: 'url(/assets/helios-logo.png)', boxShadow: '0 0 20px rgba(255,122,24,0.45)' }} />
        Helios AI
      </div>

      <div className="text-center flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold">Create your account</h1>
        <p className="text-[14px] text-[#9a9a9d]">Get access to Mission Control.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {state.error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl
                          bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13.5px] text-[#ff8a7a]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0">
              <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">Full Name</label>
          <input id="name" name="name" type="text" autoComplete="name" required autoFocus
            placeholder="Your name"
            className="h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                       placeholder:text-[#6a6a6e] outline-none transition-all focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04]" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">Work Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required
            placeholder="you@yourbusiness.com"
            className="h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                       placeholder:text-[#6a6a6e] outline-none transition-all focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04]" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">Password</label>
          <div className="relative">
            <input id="password" name="password" type={showPass ? 'text' : 'password'}
              autoComplete="new-password" required placeholder="Min. 6 characters"
              className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 pr-12 text-[14px] text-white
                         placeholder:text-[#6a6a6e] outline-none transition-all focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04]" />
            <button type="button" tabIndex={-1} onClick={() => setShowPass((s) => !s)}
              className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-[#6a6a6e] hover:text-[#9a9a9d]">
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <button type="submit" disabled={pending}
          className="btn-primary w-full h-[50px] text-[15px] justify-center">
          {pending ? (
            <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" />Creating account…</>
          ) : (
            <>Create Account <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg></>
          )}
        </button>
      </form>

      <div className="flex items-center justify-center pt-4 border-t border-white/[0.06] text-[11.5px] text-[#6a6a6e]">
        Already have an account?&nbsp;
        <Link href="/login" className="text-[#ffae3c] hover:text-[#ff7a18] transition-colors">Sign in</Link>
      </div>
    </div>
  )
}
