// ── Phase 29: Server-side guard for /client routes ────────────────
//
// Use this from /client/*/page.tsx and /client/layout.tsx Server
// Components. Returns a typed ClientSession or redirects to /login.
//
// Order of resolution:
//   1. Real Supabase session → look up business_members → ClientSession
//   2. No Supabase session → redirect('/login?redirectTo=...')
//   3. Mock auth enabled (dev) and Supabase not configured → MOCK_CLIENT_SESSION
//
// Real Supabase is always preferred. The mock fallback is dev-only
// scaffolding and is fully bypassed when Supabase credentials exist.

import 'server-only'

import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { mockAuthEnabled, MOCK_CLIENT_SESSION } from './mock-session'
import type { ClientSession, ClientRole } from './types'
import type { PlanId } from '@/lib/billing/plans'

interface RequireClientOptions {
  /** Path the user was trying to reach — used for redirectTo */
  redirectFrom?: string
  /** Minimum client role required to view this route */
  minRole?: ClientRole
}

export async function requireClient(
  options: RequireClientOptions = {},
): Promise<ClientSession> {
  // 1. Try real Supabase first when env vars are present
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const redirectTo = options.redirectFrom ? `?redirectTo=${encodeURIComponent(options.redirectFrom)}` : ''
      redirect(`/login${redirectTo}`)
    }

    // Look up the user's business membership
    let { data: membership } = await supabase
      .from('business_members')
      .select('business_id, role, businesses(name)')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    // Service-role fallback for RLS edge cases (matches dashboard/page.tsx pattern)
    if (!membership && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const db = createServiceRoleClient()
      const { data: svc } = await db
        .from('business_members')
        .select('business_id, role, businesses(name)')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (svc) membership = svc
    }

    if (!membership) {
      // No business yet — send to setup
      redirect('/dashboard/setup')
    }

    // Load profile + plan
    const [{ data: profile }, { data: subscription }] = await Promise.all([
      supabase.from('profiles').select('email, full_name, avatar_url').eq('id', user.id).single(),
      supabase.from('subscriptions').select('plan_id').eq('business_id', membership.business_id).maybeSingle(),
    ])

    const businessName =
      (membership as { businesses?: { name?: string } | null } | null)?.businesses?.name ?? 'Your Business'

    const session: ClientSession = {
      userId:       user.id,
      email:        profile?.email ?? user.email ?? '',
      fullName:     profile?.full_name ?? null,
      businessId:   membership.business_id,
      businessName,
      role:         normalizeClientRole(membership.role),
      plan:         (subscription?.plan_id as PlanId | undefined) ?? 'free',
      avatarUrl:    profile?.avatar_url ?? null,
    }

    if (options.minRole && !roleAtLeast(session.role, options.minRole)) {
      redirect('/client/dashboard?error=insufficient_role')
    }

    return session
  }

  // 2. Supabase not configured — only fall back to mock in dev
  if (mockAuthEnabled()) {
    return MOCK_CLIENT_SESSION
  }

  redirect('/login')
}

function normalizeClientRole(raw: string | null | undefined): ClientRole {
  if (raw === 'owner' || raw === 'admin' || raw === 'staff' || raw === 'viewer') return raw
  return 'viewer'
}

function roleAtLeast(role: ClientRole, minimum: ClientRole): boolean {
  const rank: Record<ClientRole, number> = { viewer: 0, staff: 1, admin: 2, owner: 3 }
  return rank[role] >= rank[minimum]
}
