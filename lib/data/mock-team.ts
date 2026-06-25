// ── Phase 29: Mock internal team data for /team demos ────────────
//
// Renders the team ops portal when Supabase is not configured.
// All shapes mirror an expected team_members table for easy migration.

import type { TeamRole } from '@/lib/auth/types'

export interface MockTeamMember {
  id:        string
  user_id:   string
  email:     string
  full_name: string
  role:      TeamRole
  active:    boolean
  joined_at: string
}

export const MOCK_TEAM_MEMBERS: MockTeamMember[] = [
  { id: 'mock-team-founder',  user_id: 'mock-team-user',   email: 'founder@helios.ai',  full_name: 'Helios Founder',  role: 'founder_admin', active: true, joined_at: '2026-01-01T00:00:00Z' },
  { id: 'mock-team-sales',    user_id: 'mock-sales-user',  email: 'sales@helios.ai',    full_name: 'Sales Lead',      role: 'team_sales',    active: true, joined_at: '2026-02-12T00:00:00Z' },
  { id: 'mock-team-delivery', user_id: 'mock-delivery-u',  email: 'delivery@helios.ai', full_name: 'Delivery Lead',   role: 'team_delivery', active: true, joined_at: '2026-02-12T00:00:00Z' },
  { id: 'mock-team-content',  user_id: 'mock-content-u',   email: 'content@helios.ai',  full_name: 'Content Lead',    role: 'team_content',  active: true, joined_at: '2026-03-04T00:00:00Z' },
  { id: 'mock-team-support',  user_id: 'mock-support-u',   email: 'support@helios.ai',  full_name: 'Support Agent',   role: 'team_support',  active: true, joined_at: '2026-03-04T00:00:00Z' },
  { id: 'mock-team-analyst',  user_id: 'mock-analyst-u',   email: 'analyst@helios.ai',  full_name: 'Ops Analyst',     role: 'team_analyst',  active: true, joined_at: '2026-03-04T00:00:00Z' },
]

// ── Pipeline (sales) ──────────────────────────────────────────────

export interface MockPipelineDeal {
  id:           string
  business:     string
  contact:      string
  stage:        'new' | 'qualified' | 'audit_sent' | 'proposal' | 'won' | 'lost'
  plan_target:  'starter' | 'pro' | 'scale'
  value_usd:    number
  next_action:  string
  updated_at:   string
}

export const MOCK_PIPELINE: MockPipelineDeal[] = [
  { id: 'd1', business: 'Atlas Auto Repairs',  contact: 'Jermaine D.',  stage: 'audit_sent', plan_target: 'pro',     value_usd: 2500, next_action: 'Follow up 2026-05-19', updated_at: '2026-05-15T10:00:00Z' },
  { id: 'd2', business: 'Crown Hair Studio',   contact: 'Imani P.',     stage: 'qualified',  plan_target: 'starter', value_usd: 999,  next_action: 'Send audit',           updated_at: '2026-05-16T10:00:00Z' },
  { id: 'd3', business: 'Reef Dental Care',    contact: 'Dr. Wallace',  stage: 'proposal',   plan_target: 'scale',   value_usd: 5000, next_action: 'Schedule strategy call', updated_at: '2026-05-13T10:00:00Z' },
  { id: 'd4', business: 'Sunrise Beauty Spa',  contact: 'Anneka M.',    stage: 'won',        plan_target: 'scale',   value_usd: 5000, next_action: 'Begin onboarding',     updated_at: '2026-05-10T10:00:00Z' },
]

// ── Delivery projects ─────────────────────────────────────────────

export interface MockDeliveryProject {
  id:          string
  business:    string
  stage:       'kickoff' | 'build' | 'qa' | 'launch' | 'optimization'
  progress:    number
  owner:       string
  due_date:    string
}

export const MOCK_DELIVERY: MockDeliveryProject[] = [
  { id: 'p1', business: 'Sunrise Beauty Spa',  stage: 'optimization', progress: 92, owner: 'Delivery Lead', due_date: '2026-05-25' },
  { id: 'p2', business: 'Atlas Auto Repairs',  stage: 'build',        progress: 45, owner: 'Delivery Lead', due_date: '2026-05-30' },
  { id: 'p3', business: 'Reef Dental Care',    stage: 'qa',           progress: 78, owner: 'Delivery Lead', due_date: '2026-05-22' },
]

// ── Outreach campaigns ────────────────────────────────────────────

export interface MockOutreach {
  id:          string
  campaign:    string
  channel:     'email' | 'whatsapp' | 'instagram' | 'cold_call'
  sent:        number
  replied:     number
  meetings:    number
  status:      'active' | 'paused' | 'completed'
}

export const MOCK_OUTREACH: MockOutreach[] = [
  { id: 'o1', campaign: 'Q2 Barbershops — JM',     channel: 'instagram', sent: 240, replied: 38, meetings: 11, status: 'active'    },
  { id: 'o2', campaign: 'Auto Repair — Caribbean', channel: 'email',     sent: 180, replied: 22, meetings: 6,  status: 'active'    },
  { id: 'o3', campaign: 'Spa Owners — May',        channel: 'whatsapp',  sent: 120, replied: 31, meetings: 14, status: 'completed' },
]

// ── Support tickets ──────────────────────────────────────────────

export interface MockSupportTicket {
  id:         string
  business:   string
  subject:    string
  status:     'open' | 'in_progress' | 'resolved'
  priority:   'low' | 'medium' | 'high' | 'urgent'
  opened_at:  string
}

export const MOCK_SUPPORT: MockSupportTicket[] = [
  { id: 's1', business: 'Sunrise Beauty Spa', subject: 'WhatsApp template approval delayed',  status: 'in_progress', priority: 'high',   opened_at: '2026-05-15T10:00:00Z' },
  { id: 's2', business: 'Demo Barber Shop',   subject: 'Cal.com event types missing',         status: 'open',        priority: 'medium', opened_at: '2026-05-16T10:00:00Z' },
]

// ── Agent runs (for analyst view) ─────────────────────────────────

export interface MockAgentRun {
  id:           string
  agent:        string
  business:     string
  status:       'queued' | 'running' | 'complete' | 'failed'
  duration_ms:  number | null
  triggered_by: string
  started_at:   string
}

export const MOCK_AGENT_RUNS: MockAgentRun[] = [
  { id: 'r1', agent: 'Business Research Agent', business: 'Crown Hair Studio',  status: 'complete', duration_ms: 18420, triggered_by: 'sales@helios.ai',   started_at: '2026-05-16T09:11:00Z' },
  { id: 'r2', agent: 'Website Audit Agent',     business: 'Atlas Auto Repairs', status: 'complete', duration_ms: 42100, triggered_by: 'analyst@helios.ai', started_at: '2026-05-15T14:22:00Z' },
  { id: 'r3', agent: 'Delivery QA Agent',       business: 'Reef Dental Care',   status: 'running',  duration_ms: null,  triggered_by: 'delivery@helios.ai', started_at: '2026-05-17T09:30:00Z' },
]
