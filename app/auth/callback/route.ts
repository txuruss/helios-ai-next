import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafePostLoginRedirect } from '@/lib/auth/post-login-redirect'

// Handles the redirect from Supabase after email confirmation.
// Supabase sends the user to: /auth/callback?code=<code>&next=<path>
//
// `next` is treated as a hint, NOT a trusted destination. After the
// session is established we look up the user's role and use
// getSafePostLoginRedirect() to either honor `next` (if the user has
// permission for it) or fall back to the role-appropriate home.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Pull the user from the freshly-established session — never from
      // the request URL — so identity stays server-side.
      const { data: { user } } = await supabase.auth.getUser()
      const dest = user
        ? await getSafePostLoginRedirect(user.id, next)
        : '/dashboard'
      return NextResponse.redirect(`${origin}${dest}`)
    }
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
