import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isRelevanceConfigured } from '@/lib/relevance/client'

// GET /api/relevance/workforces
// Protected — returns workforces visible to this business.

export async function GET() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()
  if (!membership) return NextResponse.json({ error: 'No business found.' }, { status: 404 })

  const { data: workforces } = await db
    .from('relevance_workforces')
    .select('id, name, description, relevance_workforce_id, status, is_enabled, required_plan')
    .is('business_id', null)
    .eq('is_enabled', true)
    .order('name')

  return NextResponse.json({
    ok:                   true,
    relevance_configured: isRelevanceConfigured(),
    workforces:           workforces ?? [],
  })
}
