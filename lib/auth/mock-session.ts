// ── Phase 29: Mock session data ──────────────────────────────────
//
// PURPOSE
// Provides deterministic mock sessions for development and demos when
// Supabase is not yet configured. Real Supabase auth (lib/auth/actions.ts
// + lib/supabase/server.ts) remains the production source of truth.
//
// HOW IT IS USED
// require-client.ts and require-team.ts only fall back to mock data
// when there is no Supabase user AND we are not in production. In
// production, mock sessions are NEVER returned — the user is redirected
// to /login or /team/login instead.
//
// SECURITY
// This file contains no secrets. It contains only static UI seed data
// used to render the portal shells when no real session exists.

import type { ClientSession, TeamSession } from './types'

// ── Mock client (business owner) ─────────────────────────────────

export const MOCK_CLIENT_SESSION: ClientSession = {
  userId:       'mock-client-user',
  email:        'demo@helios.ai',
  fullName:     'Demo Owner',
  businessId:   'mock-business-001',
  businessName: 'Demo Barber Shop',
  role:         'owner',
  plan:         'pro',
  avatarUrl:    null,
}

// ── Mock internal team member ────────────────────────────────────

export const MOCK_TEAM_SESSION: TeamSession = {
  teamMemberId: 'mock-team-founder',
  userId:       'mock-team-user',
  email:        'founder@helios.ai',
  fullName:     'Helios Founder',
  role:         'founder_admin',
  avatarUrl:    null,
}

// ── Dev-only flag ────────────────────────────────────────────────

// Set HELIOS_ENABLE_MOCK_AUTH=true in .env.local to allow portal pages
// to render mock data when no Supabase user is present. In production
// this flag is ignored — Supabase auth is required.
export function mockAuthEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.HELIOS_ENABLE_MOCK_AUTH === 'true'
}
