import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import AgentsClient from './AgentsClient'
import { isRelevanceConfigured } from '@/lib/relevance/client'
import { getBusinessPlan } from '@/lib/billing/limits'
import type { HeliosAgent, RelevanceWorkforce, AgentRun, AgentRecommendation, AgentSettings } from '@/types'

export default async function AgentsPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const { data: membership } = user
    ? await authClient
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
    : { data: null }

  const businessId = (membership as { business_id: string } | null)?.business_id ?? null

  let agents:          HeliosAgent[]        = []
  let workforces:      RelevanceWorkforce[]  = []
  let recentRuns:      AgentRun[]           = []
  let recommendations: AgentRecommendation[] = []
  let agentSettings:   AgentSettings | null = null
  let currentPlan     = 'starter'
  let totalAgentsInDb = 0

  // Global agents and workforces load for any authenticated user —
  // they have business_id IS NULL and are not tied to a specific business.
  // Do NOT gate on businessId here; that would hide them from users
  // who haven't created a business yet.
  if (user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createServiceRoleClient()

    // Always fetch global agents and workforces regardless of business membership
    const [agentsRes, wfRes, totalRes] = await Promise.all([
      db.from('helios_agents')
        .select('*')
        .is('business_id', null)
        .eq('is_enabled', true)
        .order('category')
        .order('name'),
      db.from('relevance_workforces')
        .select('*')
        .is('business_id', null)
        .eq('is_enabled', true)
        .order('name'),
      // Count ALL agents (enabled or not) to distinguish "no data" vs "no match"
      db.from('helios_agents')
        .select('id', { count: 'exact', head: true }),
    ])

    agents          = (agentsRes.data ?? []) as HeliosAgent[]
    workforces      = (wfRes.data     ?? []) as RelevanceWorkforce[]
    totalAgentsInDb = totalRes.count ?? 0

    // Business-specific data only when the user has a business
    if (businessId) {
      const [runsRes, recsRes, settingsRes, plan] = await Promise.all([
        db.from('agent_runs')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(20),
        db.from('agent_recommendations')
          .select('*')
          .eq('business_id', businessId)
          .in('status', ['pending', 'approved'])
          .order('priority')
          .limit(10),
        db.from('agent_settings')
          .select('*')
          .eq('business_id', businessId)
          .single(),
        getBusinessPlan(db, businessId),
      ])

      recentRuns      = (runsRes.data    ?? []) as AgentRun[]
      recommendations = (recsRes.data    ?? []) as AgentRecommendation[]
      agentSettings   = settingsRes.data as AgentSettings | null
      currentPlan     = plan
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="AI Agents"
        title="Agent Hub"
        description="Configure your AI assistant, run Helios AI agents, and monitor all operations."
      />
      <AgentsClient
        agents={agents}
        workforces={workforces}
        recentRuns={recentRuns}
        recommendations={recommendations}
        initialSettings={agentSettings}
        relevanceConfigured={isRelevanceConfigured()}
        currentPlan={currentPlan}
        businessId={businessId}
        totalAgentsInDb={totalAgentsInDb}
      />
    </>
  )
}
