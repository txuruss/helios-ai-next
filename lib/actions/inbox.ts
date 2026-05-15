'use server'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getBusinessPlan } from '@/lib/billing/limits'
import {
  conversationStatusSchema,
  conversationPrioritySchema,
  internalNoteSchema,
} from '@/lib/validation/whatsapp'
import { captureApiError } from '@/lib/logging/api'
import type { WhatsAppMessage, HandoffStatus, ConversationPriority } from '@/types'

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

type DbRow = Record<string, unknown>

// ── Auth helper ───────────────────────────────────────────────────

interface AuthResult {
  ok:         true
  userId:     string
  businessId: string
  plan:       string
}
interface AuthError { ok: false; error: string }

async function requireInboxAccess(): Promise<AuthResult | AuthError> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in to access the inbox.' }

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { ok: false, error: 'No business found.' }

  const businessId = (membership as DbRow).business_id as string
  const plan       = await getBusinessPlan(db, businessId)

  if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) {
    return { ok: false, error: 'Inbox requires the Pro plan.' }
  }

  return { ok: true, userId: user.id, businessId, plan }
}

// ── getConversations ──────────────────────────────────────────────

export type InboxFilter = 'all' | 'ai' | 'human_requested' | 'human' | 'resolved' | 'archived'

export interface InboxStats {
  all:              number
  ai:               number
  human_requested:  number
  human:            number
  resolved:         number
  archived:         number
  [key: string]:    number   // index signature for Record-style access
}

export interface ConversationSummary {
  id:                        string
  business_id:               string
  external_thread_id:        string | null
  handoff_status:            HandoffStatus
  priority:                  ConversationPriority
  status:                    'active' | 'completed' | 'abandoned'
  assigned_to:               string | null
  lead_id:                   string | null
  last_customer_message_at:  string | null
  last_agent_reply_at:       string | null
  created_at:                string
  updated_at:                string
  last_message_preview:      string | null
  lead_name:                 string | null
}

export async function getConversations(
  filter:  InboxFilter = 'all',
  limit    = 50,
): Promise<{
  conversations: ConversationSummary[]
  stats:         InboxStats
  plan:          string
  error:         string | null
}> {
  const auth = await requireInboxAccess()
  if (!auth.ok) return { conversations: [], stats: zeroStats(), plan: 'starter', error: auth.error }

  const db = createServiceRoleClient()

  try {
    // Fetch sessions filtered by channel + handoff_status
    let query = db
      .from('chat_sessions')
      .select('id, business_id, external_thread_id, handoff_status, priority, status, assigned_to, lead_id, last_customer_message_at, last_agent_reply_at, created_at, updated_at')
      .eq('business_id', auth.businessId)
      .eq('channel', 'whatsapp')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (filter !== 'all') {
      query = query.eq('handoff_status', filter)
    }

    const { data: sessions, error: sessErr } = await query
    if (sessErr) throw sessErr

    // Fetch last message for each session (content_summary)
    const sessionIds = (sessions ?? []).map((s: DbRow) => s.id as string)

    let lastMessages: Record<string, string> = {}
    if (sessionIds.length > 0) {
      const { data: msgs } = await db
        .from('whatsapp_messages')
        .select('chat_session_id, content_summary, direction, created_at')
        .in('chat_session_id', sessionIds)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: false })

      // Keep only the latest per session
      for (const m of ((msgs ?? []) as DbRow[])) {
        const sid = m.chat_session_id as string
        if (!lastMessages[sid]) {
          lastMessages[sid] = (m.content_summary as string | null) ?? ''
        }
      }
    }

    // Fetch lead names
    const leadIds = (sessions ?? [])
      .map((s: DbRow) => s.lead_id as string | null)
      .filter((id: string | null): id is string => !!id)

    let leadNames: Record<string, string | null> = {}
    if (leadIds.length > 0) {
      const { data: leads } = await db
        .from('leads').select('id, name').in('id', leadIds)
      for (const l of ((leads ?? []) as DbRow[])) {
        leadNames[l.id as string] = (l.name as string | null) ?? null
      }
    }

    // Stats query (count by handoff_status)
    const { data: statRows } = await db
      .from('chat_sessions')
      .select('handoff_status')
      .eq('business_id', auth.businessId)
      .eq('channel', 'whatsapp')

    const stats = zeroStats()
    stats.all = (statRows ?? []).length
    for (const r of ((statRows ?? []) as DbRow[])) {
      const hs = r.handoff_status as string
      if (hs in stats) stats[hs]++
    }

    const conversations: ConversationSummary[] = (sessions ?? []).map((s: DbRow) => ({
      id:                       s.id as string,
      business_id:              s.business_id as string,
      external_thread_id:       s.external_thread_id as string | null,
      handoff_status:           s.handoff_status as HandoffStatus,
      priority:                 (s.priority ?? 'normal') as ConversationPriority,
      status:                   s.status as 'active' | 'completed' | 'abandoned',
      assigned_to:              s.assigned_to as string | null,
      lead_id:                  s.lead_id as string | null,
      last_customer_message_at: s.last_customer_message_at as string | null,
      last_agent_reply_at:      s.last_agent_reply_at as string | null,
      created_at:               s.created_at as string,
      updated_at:               s.updated_at as string,
      last_message_preview:     lastMessages[s.id as string] ?? null,
      lead_name:                s.lead_id ? (leadNames[s.lead_id as string] ?? null) : null,
    }))

    return { conversations, stats, plan: auth.plan, error: null }
  } catch (err) {
    console.error('[inbox] getConversations error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: 'actions/inbox', error_type: 'get_conversations_error', business_id: auth.businessId })
    return { conversations: [], stats: zeroStats(), plan: auth.plan, error: 'Could not load conversations.' }
  }
}

function zeroStats(): InboxStats {
  return { all: 0, ai: 0, human_requested: 0, human: 0, resolved: 0, archived: 0 }
}

// ── getConversationThread ──────────────────────────────────────────

export interface ThreadSession {
  id:                  string
  external_thread_id:  string | null
  handoff_status:      HandoffStatus
  priority:            ConversationPriority
  assigned_to:         string | null
  lead_id:             string | null
  internal_notes:      string | null
  updated_at:          string
}

export async function getConversationThread(
  sessionId: string,
): Promise<{
  session:  ThreadSession | null
  messages: WhatsAppMessage[]
  error:    string | null
}> {
  const auth = await requireInboxAccess()
  if (!auth.ok) return { session: null, messages: [], error: auth.error }

  const db = createServiceRoleClient()

  try {
    const { data: sess, error: sessErr } = await db
      .from('chat_sessions')
      .select('id, business_id, external_thread_id, handoff_status, priority, assigned_to, lead_id, internal_notes, updated_at')
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)
      .single()

    if (sessErr || !sess) return { session: null, messages: [], error: 'Conversation not found.' }

    const s = sess as DbRow
    const session: ThreadSession = {
      id:                 s.id as string,
      external_thread_id: s.external_thread_id as string | null,
      handoff_status:     s.handoff_status as HandoffStatus,
      priority:           (s.priority ?? 'normal') as ConversationPriority,
      assigned_to:        s.assigned_to as string | null,
      lead_id:            s.lead_id as string | null,
      internal_notes:     s.internal_notes as string | null,
      updated_at:         s.updated_at as string,
    }

    const { data: msgs, error: msgErr } = await db
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_session_id', sessionId)
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (msgErr) throw msgErr

    return {
      session,
      messages: (msgs ?? []) as WhatsAppMessage[],
      error: null,
    }
  } catch (err) {
    console.error('[inbox] getConversationThread error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: 'actions/inbox', error_type: 'get_thread_error', business_id: auth.businessId })
    return { session: null, messages: [], error: 'Could not load conversation.' }
  }
}

// ── updateConversationStatus ───────────────────────────────────────

export async function updateConversationStatus(
  sessionId:     string,
  handoffStatus: HandoffStatus,
): Promise<{ success?: string; error?: string }> {
  const parsed = conversationStatusSchema.safeParse({ session_id: sessionId, handoff_status: handoffStatus })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    const { error: upErr } = await db
      .from('chat_sessions')
      .update({ handoff_status: handoffStatus })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)

    if (upErr) throw upErr

    await db.from('audit_logs').insert({
      business_id: auth.businessId,
      user_id:     auth.userId,
      action:      `whatsapp.conversation.${handoffStatus}`,
      resource:    'chat_sessions',
      resource_id: sessionId,
    }).catch(() => undefined)

    return { success: `Conversation marked as ${handoffStatus}.` }
  } catch (err) {
    console.error('[inbox] updateConversationStatus error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: 'actions/inbox', error_type: 'update_status_error', business_id: auth.businessId })
    return { error: 'Could not update conversation status.' }
  }
}

// ── updateConversationPriority ─────────────────────────────────────

export async function updateConversationPriority(
  sessionId: string,
  priority:  ConversationPriority,
): Promise<{ success?: string; error?: string }> {
  const parsed = conversationPrioritySchema.safeParse({ session_id: sessionId, priority })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    const { error: upErr } = await db
      .from('chat_sessions')
      .update({ priority })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)

    if (upErr) throw upErr
    return { success: `Priority set to ${priority}.` }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'update_priority_error', business_id: auth.businessId })
    return { error: 'Could not update priority.' }
  }
}

// ── assignConversation ────────────────────────────────────────────

export async function assignConversation(
  sessionId: string,
): Promise<{ success?: string; error?: string }> {
  if (!sessionId) return { error: 'Invalid session.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    // Release any existing active assignments for this session
    await db.from('conversation_assignments')
      .update({ status: 'released' })
      .eq('chat_session_id', sessionId)
      .eq('business_id', auth.businessId)
      .eq('status', 'active')

    // Create new assignment
    await db.from('conversation_assignments').insert({
      business_id:     auth.businessId,
      chat_session_id: sessionId,
      assigned_to:     auth.userId,
      assigned_by:     auth.userId,
      status:          'active',
    })

    // Update session
    await db.from('chat_sessions')
      .update({ assigned_to: auth.userId, handoff_status: 'human' })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)

    return { success: 'Conversation assigned to you.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'assign_error', business_id: auth.businessId })
    return { error: 'Could not assign conversation.' }
  }
}

// ── addInternalNote ───────────────────────────────────────────────

export async function addInternalNote(
  sessionId: string,
  note:      string,
): Promise<{ success?: string; error?: string }> {
  const parsed = internalNoteSchema.safeParse({ session_id: sessionId, note })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Invalid input.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    // Verify session belongs to business
    const { data: sess } = await db
      .from('chat_sessions').select('id, business_id').eq('id', sessionId).eq('business_id', auth.businessId).single()
    if (!sess) return { error: 'Conversation not found.' }

    // Save internal note as a special whatsapp_messages row
    const noteId = `note_${Date.now()}`
    await db.from('whatsapp_messages').insert({
      business_id:         auth.businessId,
      chat_session_id:     sessionId,
      whatsapp_message_id: noteId,
      from_phone:          auth.userId,
      to_phone:            'internal',
      direction:           'outbound',
      message_type:        'text',
      content_summary:     note.slice(0, 200),
      status:              'sent',
      is_internal_note:    true,
      sent_by_user_id:     auth.userId,
    })

    return { success: 'Note saved.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'add_note_error', business_id: auth.businessId })
    return { error: 'Could not save note.' }
  }
}

// ── getInboxStats ─────────────────────────────────────────────────

export async function getInboxStats(): Promise<{
  stats: InboxStats
  plan:  string
  error: string | null
}> {
  const auth = await requireInboxAccess()
  if (!auth.ok) return { stats: zeroStats(), plan: 'starter', error: auth.error }

  const db = createServiceRoleClient()
  try {
    const { data: rows } = await db
      .from('chat_sessions')
      .select('handoff_status')
      .eq('business_id', auth.businessId)
      .eq('channel', 'whatsapp')

    const stats = zeroStats()
    stats.all = (rows ?? []).length
    for (const r of ((rows ?? []) as DbRow[])) {
      const hs = r.handoff_status as string
      if (hs in stats) stats[hs]++
    }

    return { stats, plan: auth.plan, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'get_stats_error', business_id: auth.businessId })
    return { stats: zeroStats(), plan: auth.plan, error: 'Could not load stats.' }
  }
}
