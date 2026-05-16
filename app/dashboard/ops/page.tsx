import {
  getOpsOverview, getOpsEvents, getOpsTasks, getOpsAlerts,
  getApprovalItems, getSystemHealthSummary, getClientSystemsSummary,
  getAutomationRules, getSlaPolicies, getNotificationRules,
  getOpsAuditTrailAction, getSlaDashboardSummary, getOpsExports,
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
  const validTabs: OpsTab[] = ['overview','activity','alerts','tasks','approvals','health','clients','automation','sla']
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
    { rules },
    { policies },
    { rules: notifRules },
    { rows: auditRows },
    { summary: slaSummary },
    { exports: opsExports },
  ] = await Promise.all([
    getOpsOverview(),
    getOpsEvents(50),
    getOpsAlerts(50),
    getOpsTasks(50),
    getApprovalItems(50),
    getSystemHealthSummary(),
    getClientSystemsSummary(),
    getAutomationRules(),
    getSlaPolicies(),
    getNotificationRules(),
    getOpsAuditTrailAction(30),
    getSlaDashboardSummary(),
    getOpsExports(20),
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
      initialRules={rules}
      initialPolicies={policies}
      initialNotifRules={notifRules}
      initialAudit={auditRows}
      initialSlaSummary={slaSummary}
      initialExports={opsExports}
      businessId={businessId}
      plan={plan}
    />
  )
}
