import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import AgentsClient from './AgentsClient'
import type { AgentSettings } from '@/types'

export default async function AgentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = user
    ? await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
    : { data: null }

  const { data: agentSettings } = membership
    ? await supabase
        .from('agent_settings')
        .select('*')
        .eq('business_id', membership.business_id)
        .single()
    : { data: null }

  return (
    <>
      <PageHeader
        eyebrow="AI Agents"
        title="Agent Hub"
        description="Configure your AI assistant and monitor all Helios AI agents."
      />
      <AgentsClient initialSettings={agentSettings as AgentSettings | null} />
    </>
  )
}
