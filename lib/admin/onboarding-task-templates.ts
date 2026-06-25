// ── Plan-based onboarding checklist templates ─────────────────────
//
// Pure data + pure functions (no DB, no secrets) so this module is safe
// to import from both server actions and client components.
//
// Stored client plans are 'starter' | 'pro' | 'scale' (public labels:
// Starter / Booking OS / Helios AIOS). Template keys mirror the public
// product names. Mapping:
//   starter            → Starter
//   pro   / "booking"  → Booking OS
//   scale / "ops"      → Helios AIOS
//   missing / unknown  → Starter (safe fallback)

import type { DefaultTask } from './onboarding-tasks'

export type OnboardingTemplateKey = 'starter' | 'booking_os' | 'ops_center'

export interface OnboardingTemplate {
  label: string
  tasks: DefaultTask[]
}

const STARTER_TASKS: DefaultTask[] = [
  { title: 'Collect business information',     category: 'onboarding', priority: 'high'   },
  { title: 'Confirm services and pricing',     category: 'onboarding', priority: 'high'   },
  { title: 'Confirm business hours',           category: 'onboarding', priority: 'normal' },
  { title: 'Confirm website/contact details',  category: 'setup',      priority: 'normal' },
  { title: 'Set up basic AI chat assistant',   category: 'automation', priority: 'high'   },
  { title: 'Connect lead capture',             category: 'automation', priority: 'high'   },
  { title: 'Test lead capture form',           category: 'QA',         priority: 'normal' },
  { title: 'Send client handoff',              category: 'handoff',    priority: 'normal' },
  { title: 'Mark client live',                 category: 'handoff',    priority: 'high'   },
]

const BOOKING_OS_TASKS: DefaultTask[] = [
  { title: 'Collect business information',     category: 'onboarding',    priority: 'high'   },
  { title: 'Confirm services and pricing',     category: 'onboarding',    priority: 'high'   },
  { title: 'Confirm business hours',           category: 'onboarding',    priority: 'normal' },
  { title: 'Confirm booking rules',            category: 'setup',         priority: 'high'   },
  { title: 'Confirm booking/contact flow',     category: 'setup',         priority: 'high'   },
  { title: 'Set up AI chat assistant',         category: 'automation',    priority: 'high'   },
  { title: 'Connect lead capture',             category: 'automation',    priority: 'high'   },
  { title: 'Connect booking flow',             category: 'automation',    priority: 'high'   },
  { title: 'Configure owner notifications',    category: 'communication', priority: 'high'   },
  { title: 'Test website audit/form flow',     category: 'QA',            priority: 'normal' },
  { title: 'Test booking request flow',        category: 'QA',            priority: 'high'   },
  { title: 'Test client notifications',        category: 'QA',            priority: 'normal' },
  { title: 'Send client handoff',              category: 'handoff',       priority: 'normal' },
  { title: 'Mark client live',                 category: 'handoff',       priority: 'high'   },
]

const OPS_CENTER_TASKS: DefaultTask[] = [
  { title: 'Collect business information',                    category: 'onboarding',    priority: 'high'   },
  { title: 'Confirm services, pricing, and offer structure',  category: 'onboarding',    priority: 'high'   },
  { title: 'Confirm locations, team roles, and operating hours', category: 'onboarding', priority: 'high'   },
  { title: 'Confirm booking/contact flow',                    category: 'setup',         priority: 'high'   },
  { title: 'Confirm dashboard requirements',                  category: 'setup',         priority: 'high'   },
  { title: 'Set up AI chat assistant',                        category: 'automation',    priority: 'high'   },
  { title: 'Connect lead capture',                            category: 'automation',    priority: 'high'   },
  { title: 'Connect booking flow',                            category: 'automation',    priority: 'high'   },
  { title: 'Configure client onboarding flow',                category: 'automation',    priority: 'high'   },
  { title: 'Configure owner/admin notifications',             category: 'communication', priority: 'high'   },
  { title: 'Configure lead dashboard',                        category: 'setup',         priority: 'high'   },
  { title: 'Configure reporting or analytics view',           category: 'setup',         priority: 'normal' },
  { title: 'Test audit/form flow',                            category: 'QA',            priority: 'normal' },
  { title: 'Test booking flow',                               category: 'QA',            priority: 'high'   },
  { title: 'Test notifications',                              category: 'QA',            priority: 'normal' },
  { title: 'Test dashboard workflow',                         category: 'QA',            priority: 'high'   },
  { title: 'Run full delivery QA checklist',                  category: 'QA',            priority: 'high'   },
  { title: 'Send client handoff',                             category: 'handoff',       priority: 'normal' },
  { title: 'Mark client live',                                category: 'handoff',       priority: 'high'   },
]

export const ONBOARDING_TASK_TEMPLATES: Record<OnboardingTemplateKey, OnboardingTemplate> = {
  starter:    { label: 'Starter',    tasks: STARTER_TASKS    },
  booking_os: { label: 'Booking OS', tasks: BOOKING_OS_TASKS },
  ops_center: { label: 'Helios AIOS', tasks: OPS_CENTER_TASKS },
}

// Maps a stored/loose plan string → a template key, or null when unknown.
function canonicalPlan(plan: string | null | undefined): OnboardingTemplateKey | null {
  if (!plan) return null
  const s = String(plan).toLowerCase().trim()
  if (s.includes('starter') || s.includes('site'))                       return 'starter'
  if (s === 'pro' || s.includes('booking') || s.includes('growth'))      return 'booking_os'
  if (s === 'scale' || s.includes('ops') || s.includes('command'))       return 'ops_center'
  return null
}

// Always returns a usable key (Starter is the safe fallback).
export function normalizeClientPlan(plan: string | null | undefined): OnboardingTemplateKey {
  return canonicalPlan(plan) ?? 'starter'
}

export function getOnboardingTasksForPlan(plan: string | null | undefined): DefaultTask[] {
  return ONBOARDING_TASK_TEMPLATES[normalizeClientPlan(plan)].tasks
}

// UI helper: label + whether we fell back to Starter for an unknown plan.
export function getTemplateInfoForPlan(
  plan: string | null | undefined,
): { key: OnboardingTemplateKey; label: string; isFallback: boolean } {
  const known = canonicalPlan(plan)
  const key = known ?? 'starter'
  return { key, label: ONBOARDING_TASK_TEMPLATES[key].label, isFallback: known === null }
}
