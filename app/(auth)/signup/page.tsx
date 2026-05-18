import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import SignupForm from '@/components/auth/SignupForm'
import { createClient } from '@/lib/supabase/server'
import { getSafePostLoginRedirect } from '@/lib/auth/post-login-redirect'

export const metadata: Metadata = {
  title: 'Create Account — Helios AI',
}

export default async function SignupPage() {
  // Already-signed-in users skip signup and go to their role home.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const dest = await getSafePostLoginRedirect(user.id, null)
    redirect(dest)
  }

  return <SignupForm />
}
