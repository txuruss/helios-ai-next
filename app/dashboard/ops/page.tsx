import {
  getOpsOverview, getOpsEvents, getOpsTasks, getOpsAlerts,
  getApprovalItems, getSystemHealthSummary, getClientSystemsSummary,
} from '@/lib/actions/ops'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getBusinessPlan } from '@/lib/billing/limits'
import OpsCenterClient from './OpsCenterClient'
import type { OpsTab } from './OpsCenterClient'

export const metadata = { title: 'Ops Center — Helios AI' }

export default async function OpsCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: rawTab } = await searchParams
  const validTabs: OpsTab[] = ['overview','activity','alerts','tasks','approvals','health','clients']
  const initialTab: OpsTab = validTabs.includes(rawTab as OpsTab) ? (rawTab as OpsTab) : 'overview'

  // Get business context
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let businessId: string | null = null
  let plan = 'starter'

  if (user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createServiceRoleClient()
    const { data: membership } = await db
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (membership) {
      businessId = (membership as { business_id: string }).business_id
      plan       = await getBusinessPlan(db, businessId)
    }
  }

  // Load all ops data in parallel
  const [
    { metrics },
    { events },
    { alerts },
    { tasks },
    { items: approvals },
    { items: healthItems },
    { systems },
  ] = await Promise.all([
    getOpsOverview(),
    getOpsEvents(30),
    getOpsAlerts(30),
    getOpsTasks(30),
    getApprovalItems(30),
    getSystemHealthSummary(),
    getClientSystemsSummary(),
  ])

  return (
    <OpsCenterClient
      initialTab={initialTab}
      initialMetrics={metrics}
      initialEvents={events}
      initialAlerts={alerts}
      initialTasks={tasks}
      initialApprovals={approvals}
      initialHealth={healthItems}
      initialSystems={systems}
      businessId={businessId}
      plan={plan}
    />
  )
}
