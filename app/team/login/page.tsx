import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import TeamLoginForm from './TeamLoginForm'
import { createClient } from '@/lib/supabase/server'
import { getSafePostLoginRedirect } from '@/lib/auth/post-login-redirect'

export const metadata: Metadata = {
  title: 'Team Sign In — Helios AI',
  robots: { index: false, follow: false },
}

export default async function TeamLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const params = await searchParams

  // Already-signed-in users skip the team login form and land on the
  // correct portal for their role (founder → /admin, team → /team/ops,
  // client/unknown → /dashboard).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const dest = await getSafePostLoginRedirect(user.id, params.redirectTo ?? null)
    redirect(dest)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#070707]">
      <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.14), transparent 70%)' }} />

      <div className="relative z-10 w-full max-w-[440px] px-4 py-8 flex flex-col items-center gap-4">
        <TeamLoginForm
          redirectTo={params.redirectTo}
          authError={params.error}
        />

        <Link href="/" className="text-[13px] text-[#6a6a6e] hover:text-white transition-colors flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to helios.ai
        </Link>
      </div>
    </div>
  )
}
