// ============================================================
// HELIOS AI — Shared TypeScript types
// These mirror the Supabase schema in db/schema.sql.
// Phase 2: Generate precise types with `supabase gen types typescript`.
// ============================================================

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'owner' | 'admin' | 'member'
  created_at: string
  updated_at: string
}

export interface Business {
  id: string
  name: string
  slug: string
  description: string | null
  website_url: string | null
  phone: string | null
  address: string | null
  city: string | null
  country: string
  timezone: string
  business_type: string | null
  owner_notification_email: string | null
  logo_url: string | null
  hours: Record<string, { open: string; close: string; closed?: boolean }>
  created_at: string
  updated_at: string
}

export interface BusinessMember {
  id: string
  business_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface Service {
  id: string
  business_id: string
  name: string
  description: string | null
  price_cents: number | null
  duration_min: number | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FAQ {
  id: string
  business_id: string
  question: string
  answer: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AgentSettings {
  id: string
  business_id: string
  agent_name: string
  persona_prompt: string | null
  language: string
  collect_name: boolean
  collect_email: boolean
  collect_phone: boolean
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  business_id: string
  session_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  source: 'widget' | 'whatsapp' | 'form' | 'manual' | 'api'
  status: 'new' | 'qualified' | 'contacted' | 'proposal' | 'won' | 'lost'
  intent: string | null
  score: number | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  business_id: string
  lead_id: string | null
  service_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  scheduled_at: string | null
  duration_min: number | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CalcomConnection {
  id: string
  business_id: string
  calcom_user_id: string | null
  is_connected: boolean
  connected_at: string | null
  created_at: string
  updated_at: string
}

export interface WidgetSettings {
  id: string
  business_id: string
  widget_id:   string | null
  logo_url:    string | null
  primary_color: string
  bot_name: string
  welcome_message: string
  placeholder_text: string
  position: 'bottom-right' | 'bottom-left'
  is_enabled:      boolean
  show_powered_by: boolean   // true = show badge; false = hide (Pro/Scale only, Starter forced true)
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  business_id: string
  user_id:                string | null
  plan:                   'free' | 'starter' | 'pro' | 'scale'
  status:                 'trialing' | 'active' | 'past_due' | 'cancelled' |
                          'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused'
  stripe_customer_id:     string | null
  stripe_subscription_id: string | null
  stripe_price_id:        string | null
  trial_ends_at:          string | null
  current_period_start:   string | null
  current_period_end:     string | null
  cancel_at_period_end:   boolean
  metadata:               Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  business_id: string
  user_id: string | null
  type: string
  title: string
  body: string | null
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

// ── UI-level types ─────────────────────────────────────────────────

export type NavItem = {
  id: string
  label: string
  href: string
  icon: string
  badge?: number
}

export type AgentStatus = 'healthy' | 'degraded' | 'idle' | 'running'

export interface AgentCard {
  id: string
  name: string
  description: string
  status: AgentStatus
  lastRun: string
  runs: number
  errRate: string
  queue: number
}

export type ActionState = {
  error?: string
  success?: string
}

// ── Relevance AI / Agent Hub types ─────────────────────────────────

export interface HeliosAgent {
  id:                  string
  business_id:         string | null
  name:                string
  description:         string | null
  category:            string | null
  relevance_agent_id:  string | null
  status:              'idle' | 'running' | 'completed' | 'error' | 'degraded'
  is_enabled:          boolean
  required_plan:       'starter' | 'pro' | 'scale'
  created_at:          string
  updated_at:          string
}

export interface RelevanceWorkforce {
  id:                       string
  business_id:              string | null
  name:                     string
  description:              string | null
  relevance_workforce_id:   string | null
  status:                   string
  is_enabled:               boolean
  required_plan:            'starter' | 'pro' | 'scale'
  created_at:               string
  updated_at:               string
}

export interface AgentRun {
  id:               string
  business_id:      string
  agent_id:         string | null
  workforce_id:     string | null
  provider_run_id:  string | null
  run_type:         'agent' | 'workforce'
  status:           'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  input_summary:    string | null
  output_summary:   string | null
  error_message:    string | null
  started_at:       string
  completed_at:     string | null
  metadata:         Record<string, unknown>
  created_at:       string
  updated_at:       string
}

export interface AgentOutput {
  id:            string
  business_id:   string
  agent_run_id:  string
  output_type:   string
  title:         string | null
  content:       string | null
  status:        'pending_review' | 'approved' | 'rejected' | 'archived'
  metadata:      Record<string, unknown>
  created_at:    string
  updated_at:    string
}

// ── WhatsApp types ─────────────────────────────────────────────────

export interface WhatsAppConnection {
  id:                   string
  business_id:          string
  phone_number_id:      string | null
  business_account_id:  string | null
  display_phone_number: string | null
  status:               'connected' | 'disconnected' | 'error'
  is_enabled:           boolean
  metadata:             Record<string, unknown>
  created_at:           string
  updated_at:           string
}

export interface WhatsAppMessage {
  id:                   string
  business_id:          string
  lead_id:              string | null
  chat_session_id:      string | null
  whatsapp_message_id:  string
  from_phone:           string
  to_phone:             string
  direction:            'inbound' | 'outbound'
  message_type:         string
  content_summary:      string | null
  status:               'received' | 'sent' | 'failed' | 'read'
  // Phase 10 media + template + handoff fields
  media_id:             string | null
  media_url:            string | null
  media_mime_type:      string | null
  template_name:        string | null
  template_language:    string | null
  sent_by_user_id:      string | null
  is_internal_note:     boolean
  metadata:             Record<string, unknown>
  created_at:           string
}

export type HandoffStatus = 'ai' | 'human_requested' | 'human' | 'resolved' | 'archived'
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface ChatSession {
  id:                        string
  business_id:               string
  visitor_id:                string | null
  lead_id:                   string | null
  status:                    'active' | 'completed' | 'abandoned'
  channel:                   'widget' | 'whatsapp' | 'instagram' | 'api'
  external_thread_id:        string | null
  // Phase 10 handoff fields
  handoff_status:            HandoffStatus
  assigned_to:               string | null
  last_customer_message_at:  string | null
  last_agent_reply_at:       string | null
  priority:                  ConversationPriority
  tags:                      string[]
  internal_notes:            string | null
  metadata:                  Record<string, unknown>
  started_at:                string
  ended_at:                  string | null
  created_at:                string
  updated_at:                string
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

export interface ConversationAssignment {
  id:              string
  business_id:     string
  chat_session_id: string
  assigned_to:     string
  assigned_by:     string | null
  status:          'active' | 'released'
  created_at:      string
  updated_at:      string
}

export interface AgentRecommendation {
  id:                   string
  business_id:          string
  agent_run_id:         string | null
  title:                string
  description:          string | null
  recommendation_type:  string
  priority:             'low' | 'medium' | 'high' | 'critical'
  status:               'pending' | 'approved' | 'rejected' | 'completed'
  metadata:             Record<string, unknown>
  created_at:           string
  updated_at:           string
}
