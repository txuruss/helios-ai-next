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
  last_message_at:           string | null
  unread_count:              number
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
  businessId:    string | null
  error:         string | null
}> {
  const auth = await requireInboxAccess()
  if (!auth.ok) return { conversations: [], stats: zeroStats(), plan: 'starter', businessId: null, error: auth.error }

  const db = createServiceRoleClient()

  try {
    // Fetch sessions filtered by channel + handoff_status
    let query = db
      .from('chat_sessions')
      .select('id, business_id, external_thread_id, handoff_status, priority, status, assigned_to, lead_id, last_customer_message_at, last_agent_reply_at, last_message_at, last_message_preview, unread_count, created_at, updated_at')
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
      last_message_at:          (s.last_message_at as string | null) ?? null,
      unread_count:             (s.unread_count as number | null) ?? 0,
      created_at:               s.created_at as string,
      updated_at:               s.updated_at as string,
      // Prefer DB-cached preview, fall back to separate query
      last_message_preview:     (s.last_message_preview as string | null) ?? lastMessages[s.id as string] ?? null,
      lead_name:                s.lead_id ? (leadNames[s.lead_id as string] ?? null) : null,
    }))

    return { conversations, stats, plan: auth.plan, businessId: auth.businessId, error: null }
  } catch (err) {
    console.error('[inbox] getConversations error:', err instanceof Error ? err.message : err)
    captureApiError(err, { route: 'actions/inbox', error_type: 'get_conversations_error', business_id: auth.businessId })
    return { conversations: [], stats: zeroStats(), plan: auth.plan, businessId: auth.businessId, error: 'Could not load conversations.' }
  }
}

function zeroStats(): InboxStats {
  return { all: 0, ai: 0, human_requested: 0, human: 0, resolved: 0, archived: 0 }
}

// ── getConversationThread ──────────────────────────────────────────

export interface ThreadSession {
  id:                        string
  external_thread_id:        string | null
  handoff_status:            HandoffStatus
  priority:                  ConversationPriority
  assigned_to:               string | null
  lead_id:                   string | null
  internal_notes:            string | null
  last_customer_message_at:  string | null
  updated_at:                string
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
      .select('id, business_id, external_thread_id, handoff_status, priority, assigned_to, lead_id, internal_notes, last_customer_message_at, updated_at')
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)
      .single()

    if (sessErr || !sess) return { session: null, messages: [], error: 'Conversation not found.' }

    const s = sess as DbRow
    const session: ThreadSession = {
      id:                        s.id as string,
      external_thread_id:        s.external_thread_id as string | null,
      handoff_status:            s.handoff_status as HandoffStatus,
      priority:                  (s.priority ?? 'normal') as ConversationPriority,
      assigned_to:               s.assigned_to as string | null,
      lead_id:                   s.lead_id as string | null,
      internal_notes:            s.internal_notes as string | null,
      last_customer_message_at:  s.last_customer_message_at as string | null,
      updated_at:                s.updated_at as string,
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
    const { data: updatedSess } = await db
      .from('chat_sessions')
      .update({ assigned_to: auth.userId, handoff_status: 'human' })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)
      .select('external_thread_id, priority')
      .single()

    // Fire-and-forget assignment email notification
    void (async () => {
      try {
        const { sendAssignmentNotification } = await import('@/lib/notifications/assignment')
        const { data: profile } = await db
          .from('profiles').select('email').eq('id', auth.userId).single()
        const { data: biz } = await db
          .from('businesses').select('name, owner_notification_email').eq('id', auth.businessId).single()

        const phone = (updatedSess as DbRow | null)?.external_thread_id as string | null ?? ''
        const maskedPhone = phone.length > 4 ? `••• ${phone.slice(-4)}` : phone
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'

        await sendAssignmentNotification(db, {
          businessId:    auth.businessId,
          businessName:  (biz as DbRow | null)?.name as string ?? 'Your Business',
          assigneeEmail: (profile as DbRow | null)?.email as string | null ?? null,
          maskedPhone,
          priority:      (updatedSess as DbRow | null)?.priority as string ?? 'normal',
          handoffStatus: 'human',
          sessionId,
          dashboardUrl:  appUrl,
        })
      } catch (e) {
        console.error('[inbox] assignment notification failed:', (e as Error).message)
      }
    })()

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

// ── markConversationRead ──────────────────────────────────────────

export async function markConversationRead(
  sessionId: string,
): Promise<{ success?: string; error?: string }> {
  if (!sessionId) return { error: 'Invalid session.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    const { error: upErr } = await db
      .from('chat_sessions')
      .update({ unread_count: 0, last_read_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)

    if (upErr) throw upErr
    return { success: 'Marked as read.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'mark_read_error', business_id: auth.businessId })
    return { error: 'Could not mark conversation as read.' }
  }
}

// ── getInboxUnreadCount ───────────────────────────────────────────

export async function getInboxUnreadCount(): Promise<{
  count: number
  error: string | null
}> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { count: 0, error: null }

  const db = createServiceRoleClient()
  const { data: membership } = await db
    .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
  if (!membership) return { count: 0, error: null }

  const businessId = (membership as DbRow).business_id as string
  const plan       = await getBusinessPlan(db, businessId)
  if ((PLAN_ORDER[plan] ?? 0) < (PLAN_ORDER['pro'] ?? 1)) return { count: 0, error: null }

  try {
    const { data: rows } = await db
      .from('chat_sessions')
      .select('unread_count')
      .eq('business_id', businessId)
      .eq('channel', 'whatsapp')
      .gt('unread_count', 0)

    const total = ((rows ?? []) as DbRow[]).reduce((sum, r) => sum + ((r.unread_count as number) ?? 0), 0)
    return { count: total, error: null }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'unread_count_error', business_id: businessId })
    return { count: 0, error: null }
  }
}

// ── bulkUpdateConversations ───────────────────────────────────────

const BULK_MAX = 50

export type BulkAction = 'resolve' | 'archive' | 'mark_read' | 'assign_to_me'

export async function bulkUpdateConversations(
  sessionIds: string[],
  action:     BulkAction,
): Promise<{ updated: number; error?: string }> {
  if (!sessionIds.length) return { updated: 0, error: 'No conversations selected.' }
  if (sessionIds.length > BULK_MAX) return { updated: 0, error: `Select at most ${BULK_MAX} conversations at once.` }

  // Validate all IDs are valid UUIDs
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!sessionIds.every((id) => UUID_RE.test(id))) {
    return { updated: 0, error: 'Invalid session IDs.' }
  }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { updated: 0, error: auth.error }

  const db = createServiceRoleClient()

  try {
    let updates: Record<string, unknown> = {}

    if (action === 'resolve') {
      updates = { handoff_status: 'resolved', resolved_at: new Date().toISOString() }
    } else if (action === 'archive') {
      updates = { handoff_status: 'archived', archived_at: new Date().toISOString() }
    } else if (action === 'mark_read') {
      updates = { unread_count: 0, last_read_at: new Date().toISOString() }
    } else if (action === 'assign_to_me') {
      updates = { assigned_to: auth.userId, handoff_status: 'human' }
    }

    const { data, error: upErr } = await db
      .from('chat_sessions')
      .update(updates)
      .in('id', sessionIds)
      .eq('business_id', auth.businessId)
      .select('id')

    if (upErr) throw upErr

    const updated = (data ?? []).length

    await db.from('audit_logs').insert({
      business_id: auth.businessId,
      user_id:     auth.userId,
      action:      `whatsapp.bulk.${action}`,
      resource:    'chat_sessions',
    }).catch(() => undefined)

    return { updated }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'bulk_update_error', business_id: auth.businessId })
    return { updated: 0, error: 'Bulk update failed.' }
  }
}

// ── Phase 21: Conversation-level AI pause/resume ──────────────────

export async function pauseConversationAi(
  sessionId: string,
  reason?:   string,
): Promise<{ success?: string; error?: string }> {
  if (!sessionId) return { error: 'Invalid session.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    const { error: upErr } = await db
      .from('chat_sessions')
      .update({
        ai_paused:        true,
        ai_pause_reason:  reason ? reason.slice(0, 256) : null,
      })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)

    if (upErr) throw upErr

    void import('@/lib/ops/events').then(({ createOpsEvent }) =>
      createOpsEvent({
        business_id: auth.businessId,
        source:      'inbox',
        event_type:  'conversation_ai_paused',
        severity:    'info',
        title:       'AI paused for a conversation',
        metadata:    { session_id: sessionId },
      }, db)
    ).catch(() => undefined)

    void import('@/lib/analytics/posthog').then(({ capture }) =>
      capture('conversation_ai_paused', { has_reason: !!reason })
    )

    return { success: 'AI paused for this conversation.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'pause_conv_ai_error', business_id: auth.businessId })
    return { error: 'Could not pause AI for this conversation.' }
  }
}

export async function resumeConversationAi(
  sessionId: string,
): Promise<{ success?: string; error?: string }> {
  if (!sessionId) return { error: 'Invalid session.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    const { error: upErr } = await db
      .from('chat_sessions')
      .update({ ai_paused: false, ai_pause_reason: null })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)

    if (upErr) throw upErr

    void import('@/lib/analytics/posthog').then(({ capture }) =>
      capture('conversation_ai_resumed', {})
    )

    return { success: 'AI resumed for this conversation.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'resume_conv_ai_error', business_id: auth.businessId })
    return { error: 'Could not resume AI.' }
  }
}

// ── Phase 21: Get conversation AI confidence ───────────────────────

export async function getConversationAiState(
  sessionId: string,
): Promise<{
  ai_paused:            boolean
  ai_confidence:        string
  ai_review_required:   boolean
  last_confidence_reason: string | null
  error:                string | null
}> {
  const EMPTY = { ai_paused: false, ai_confidence: 'medium', ai_review_required: false, last_confidence_reason: null, error: null }
  const auth = await requireInboxAccess()
  if (!auth.ok) return { ...EMPTY, error: auth.error }
  const db = createServiceRoleClient()

  try {
    const { data } = await db
      .from('chat_sessions')
      .select('ai_paused, ai_confidence, ai_review_required, last_confidence_reason')
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)
      .single()

    if (!data) return EMPTY
    const d = data as { ai_paused?: boolean; ai_confidence?: string; ai_review_required?: boolean; last_confidence_reason?: string | null }
    return {
      ai_paused:            d.ai_paused ?? false,
      ai_confidence:        d.ai_confidence ?? 'medium',
      ai_review_required:   d.ai_review_required ?? false,
      last_confidence_reason: d.last_confidence_reason ?? null,
      error:                null,
    }
  } catch {
    return EMPTY
  }
}

// ── unassignConversation ──────────────────────────────────────────

export async function unassignConversation(
  sessionId: string,
): Promise<{ success?: string; error?: string }> {
  if (!sessionId) return { error: 'Invalid session.' }

  const auth = await requireInboxAccess()
  if (!auth.ok) return { error: auth.error }

  const db = createServiceRoleClient()
  try {
    await db.from('conversation_assignments')
      .update({ status: 'released' })
      .eq('chat_session_id', sessionId)
      .eq('business_id', auth.businessId)
      .eq('status', 'active')

    const { error: upErr } = await db
      .from('chat_sessions')
      .update({ assigned_to: null })
      .eq('id', sessionId)
      .eq('business_id', auth.businessId)

    if (upErr) throw upErr
    return { success: 'Conversation unassigned.' }
  } catch (err) {
    captureApiError(err, { route: 'actions/inbox', error_type: 'unassign_error', business_id: auth.businessId })
    return { error: 'Could not unassign conversation.' }
  }
}
