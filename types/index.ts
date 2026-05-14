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
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  business_id: string
  plan: 'free' | 'starter' | 'growth' | 'command'
  status: 'trialing' | 'active' | 'past_due' | 'cancelled'
  trial_ends_at: string | null
  current_period_end: string | null
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
