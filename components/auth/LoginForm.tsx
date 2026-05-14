'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { login } from '@/lib/auth/actions'
import type { ActionState } from '@/types'

const INITIAL: ActionState = {}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_error: 'Email confirmation failed. Please try signing in manually.',
}

export default function LoginForm({ redirectTo, authError }: { redirectTo?: string; authError?: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL)
  const [showPass, setShowPass] = useState(false)

  const displayError = state.error ?? (authError ? AUTH_ERROR_MESSAGES[authError] ?? 'Authentication error. Please sign in.' : undefined)

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
        <h1 className="text-[22px] font-semibold">Sign in to Mission Control</h1>
        <p className="text-[14px] text-[#9a9a9d]">Your AI operations dashboard.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? ''} />

        {displayError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl
                          bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[13.5px] text-[#ff8a7a]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0">
              <circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            {displayError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">
            Work Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="you@yourbusiness.com"
            className="h-[46px] rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white
                       placeholder:text-[#6a6a6e] outline-none transition-all
                       focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e]">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Min. 6 characters"
              className="h-[46px] w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 pr-12 text-[14px] text-white
                         placeholder:text-[#6a6a6e] outline-none transition-all
                         focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04]"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPass((s) => !s)}
              className="absolute right-0 top-0 h-full w-12 flex items-center justify-center
                         text-[#6a6a6e] hover:text-[#9a9a9d] transition-colors"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="text-right -mt-1">
          <span className="text-[12.5px] text-[#6a6a6e] underline underline-offset-[3px] cursor-pointer
                           hover:text-[#ffae3c] transition-colors">
            Forgot password?
          </span>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full h-[50px] text-[15px] justify-center"
        >
          {pending ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign In
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </>
          )}
        </button>
      </form>

      {/* Trust / footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]
                      text-[11.5px] text-[#6a6a6e] flex-wrap gap-2">
        <span className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d093" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5 11-12"/></svg>
          Secured via Supabase Auth
        </span>
        <Link href="/signup" className="text-[#ffae3c] hover:text-[#ff7a18] transition-colors">
          Create account →
        </Link>
      </div>
    </div>
  )
}
