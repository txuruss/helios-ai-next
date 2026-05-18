// ── Phase 29: Mock business data for /client portal demos ─────────
//
// Used by client portal pages when Supabase is not connected (dev only).
// All shapes mirror the real database schema so wiring to Supabase later
// is a drop-in change.

import type { PlanId } from '@/lib/billing/plans'
import type { ClientRole } from '@/lib/auth/types'

export interface MockBusiness {
  id:              string
  name:            string
  slug:            string
  industry:        string
  city:            string
  country:         string
  plan:            PlanId | 'free'
  audit_status:    'pending' | 'in_review' | 'sent' | 'declined'
  audit_score:     number | null
  monthly_leads:   number
  monthly_bookings: number
  created_at:      string
}

export const MOCK_BUSINESSES: MockBusiness[] = [
  {
    id:              'mock-business-001',
    name:            'Demo Barber Shop',
    slug:            'demo-barber-shop',
    industry:        'Barbershop',
    city:            'Kingston',
    country:         'Jamaica',
    plan:            'pro',
    audit_status:    'sent',
    audit_score:     82,
    monthly_leads:   148,
    monthly_bookings: 96,
    created_at:      '2026-04-12T10:00:00Z',
  },
  {
    id:              'mock-business-002',
    name:            'Sunrise Beauty Spa',
    slug:            'sunrise-beauty-spa',
    industry:        'Beauty / Spa',
    city:            'Montego Bay',
    country:         'Jamaica',
    plan:            'scale',
    audit_status:    'sent',
    audit_score:     91,
    monthly_leads:   312,
    monthly_bookings: 240,
    created_at:      '2026-03-21T10:00:00Z',
  },
  {
    id:              'mock-business-003',
    name:            'Atlas Auto Repairs',
    slug:            'atlas-auto-repairs',
    industry:        'Auto Services',
    city:            'Spanish Town',
    country:         'Jamaica',
    plan:            'starter',
    audit_status:    'in_review',
    audit_score:     null,
    monthly_leads:   54,
    monthly_bookings: 18,
    created_at:      '2026-05-08T10:00:00Z',
  },
]

export interface MockClientMember {
  user_id:   string
  email:     string
  full_name: string
  role:      ClientRole
}

export const MOCK_CLIENT_MEMBERS: MockClientMember[] = [
  { user_id: 'mock-client-user', email: 'demo@helios.ai', full_name: 'Demo Owner', role: 'owner' },
]

export function findMockBusiness(id: string): MockBusiness | null {
  return MOCK_BUSINESSES.find((b) => b.id === id) ?? null
}
