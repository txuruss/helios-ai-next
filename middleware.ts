import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2]),
          )
        },
      },
    },
  )

  // IMPORTANT: Do not write business logic here.
  // Only use getUser() — never getSession() — to avoid spoofing.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Forward the current pathname so server layouts can read it via headers().
  // This is consumed by app/team/layout.tsx to skip auth on /team/login.
  supabaseResponse.headers.set('x-pathname', pathname)
  request.headers.set('x-pathname', pathname)

  // ── Defensive: collapse /admin/admin/* doubled paths ──────────
  // A relative <Link href="admin/foo"> clicked from /admin/<x> resolves
  // to /admin/admin/foo. We don't ship any such Link in current code,
  // but stale HMR builds or future regressions could re-introduce one.
  // Strip exactly one extra "/admin" prefix and let the request flow
  // through the rest of middleware (which will catch parked routes,
  // require auth on /admin/*, etc.).
  if (pathname.startsWith('/admin/admin/') || pathname === '/admin/admin') {
    const target = request.nextUrl.clone()
    target.pathname = pathname.replace(/^\/admin\/admin/, '/admin')
    return NextResponse.redirect(target)
  }

  // ── Lean Baseline: park /team and /client ─────────────────────
  // These route groups are no longer part of MVP UX. Their page files
  // also redirect, but doing it here short-circuits before any layout
  // (which would have called requireTeam/requireClient and could 500
  // in environments missing the team_members table).
  if (pathname === '/team' || pathname.startsWith('/team/')) {
    const target = request.nextUrl.clone()
    target.pathname = '/dashboard'
    target.search = ''
    return NextResponse.redirect(target)
  }
  if (pathname === '/client' || pathname.startsWith('/client/')) {
    const target = request.nextUrl.clone()
    target.pathname = '/dashboard'
    target.search = ''
    return NextResponse.redirect(target)
  }

  // ── Protect /dashboard and all sub-routes ─────────────────────
  if (pathname.startsWith('/dashboard') && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Protect /admin portal (founder_admin only) ────────────────
  // Middleware only checks "is logged in" — the role check happens
  // server-side in lib/auth/require-admin.ts. Unauthenticated users
  // go to /login (the dedicated /team/login page is parked).
  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Authenticated users on /login or /signup ──────────────────
  // Intentionally NO hard redirect here. The pages themselves
  // (app/(auth)/login/page.tsx, app/(auth)/signup/page.tsx) call
  // getSafePostLoginRedirect() to send the user to their role home
  // (founder → /admin/mission-control, everyone else → /dashboard).
  // Doing the redirect in middleware would prevent that role lookup
  // from running and lock everyone onto /dashboard.

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
