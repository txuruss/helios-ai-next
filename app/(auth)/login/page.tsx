import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/auth/LoginForm'
import { createClient } from '@/lib/supabase/server'
import { getSafePostLoginRedirect } from '@/lib/auth/post-login-redirect'

export const metadata: Metadata = {
  title: 'Sign In — Helios AI',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const params = await searchParams

  // If the user is already signed in, route them to the role-appropriate
  // home (or honor the redirectTo hint when they're allowed there).
  // The middleware no longer hard-redirects authenticated users away
  // from /login, so this page handles the case.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const dest = await getSafePostLoginRedirect(user.id, params.redirectTo ?? null)
    redirect(dest)
  }

  return (
    <LoginForm
      redirectTo={params.redirectTo}
      authError={params.error}
    />
  )
}
