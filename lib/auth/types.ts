// ── Phase 29: Shared auth types for client portal + team ops ─────
// Client-safe type definitions used by both client and team route guards.
// These types complement the existing Supabase auth flow — they DO NOT
// replace it. Real Supabase auth (lib/auth/actions.ts) remains the source
// of truth for sessions. These types add structure for plan/role gating.

import type { PlanId } from '@/lib/billing/plans'

// ── Client portal — business owners and staff ────────────────────

export type ClientRole = 'owner' | 'admin' | 'staff' | 'viewer'

export interface ClientSession {
  userId:       string
  email:        string
  fullName:     string | null
  businessId:   string
  businessName: string
  role:         ClientRole
  plan:         PlanId | 'free'
  // Optional avatar — sourced from profiles table when available.
  avatarUrl?:   string | null
}

// ── Team portal — internal Helios AI staff ───────────────────────

export type TeamRole =
  | 'founder_admin'
  | 'sales'
  | 'delivery'
  | 'support'
  | 'analyst'

export interface TeamSession {
  teamMemberId: string
  userId:       string
  email:        string
  fullName:     string | null
  role:         TeamRole
  avatarUrl?:   string | null
}

// ── Authorization decisions ──────────────────────────────────────

export interface AuthorizationResult {
  allowed: boolean
  reason?: string
}

// ── Mock-vs-real flag (read at runtime, never bundled with secrets) ─

export function isMockAuthOnly(): boolean {
  // True when Supabase env is incomplete. Mock data is used for
  // route demonstration only — never as a real auth substitute when
  // Supabase credentials are present.
  return !process.env.NEXT_PUBLIC_SUPABASE_URL ||
         !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}
