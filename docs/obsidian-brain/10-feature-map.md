# Feature Map — Helios AI Agency

See also: [[00-source-of-truth]] | [[02-offers-and-pricing]] | [[09-open-questions]]

This note tracks the status of every feature. Only mark features as "Confirmed existing" if they are visible and functional in the codebase. Planned features are intended but not yet built. Rejected/deprecated features should not be rebuilt.

---

## Status key

| Status | Meaning |
|--------|---------|
| Confirmed | Visible in codebase AND believed to be functional |
| Needs verification | Route/file exists but functional status is unconfirmed |
| Planned | Intended build, not yet started |
| Needs approval | Proposed but not yet agreed |
| Not aligned | Does not fit current direction — do not build |
| Deprecated/Paused | Was built or planned, now paused or removed |

---

## Confirmed existing features

These were observed in the codebase during initial inspection (2026-05-22). Functional status of each needs verification.

### Public / marketing routes
| Feature | Route | Status |
|---------|-------|--------|
| Landing page / home | `app/(public)/page.tsx` | Needs verification |
| Pricing page | `app/(public)/pricing/page.tsx` | Needs verification |
| How it works page | `app/(public)/how-it-works/page.tsx` | Needs verification |
| Industries page | `app/(public)/industries/page.tsx` | Needs verification |
| Business audit page | `app/(public)/audit/page.tsx` | Needs verification |
| Choose plan page | `app/(public)/choose-plan/page.tsx` | Needs verification |
| Register business page | `app/(public)/register-business/page.tsx` | Needs verification |

### Auth
| Feature | Route | Status |
|---------|-------|--------|
| Login | `app/(auth)/login/page.tsx` | Needs verification |
| Signup | `app/(auth)/signup/page.tsx` | Needs verification |
| Team login | `app/team/login/page.tsx` | Needs verification |

### Client dashboard
| Feature | Route | Status |
|---------|-------|--------|
| Dashboard home | `app/dashboard/` | Needs verification |
| Widget settings | `app/dashboard/widget/` | Needs verification |
| WhatsApp settings | `app/dashboard/whatsapp/` | Needs verification |
| Booking settings | `app/dashboard/bookings/` | Needs verification |
| Services management | `app/dashboard/services/` | Needs verification |
| Templates | `app/dashboard/templates/` | Needs verification |
| Inbox | `app/dashboard/inbox/` | Needs verification |
| Settings / account | `app/dashboard/settings/` | Needs verification |
| Billing | `app/dashboard/settings/billing/` | Needs verification |
| Setup checklist | `app/dashboard/setup/` | Needs verification |

### Admin / internal
| Feature | Route | Status |
|---------|-------|--------|
| Mission Control | `app/admin/mission-control/` | Needs verification |
| Admin clients | `app/admin/clients/` | Needs verification |
| Admin leads | `app/admin/leads/` | Needs verification |
| Admin audits | `app/admin/audits/` | Needs verification |
| Admin bookings | `app/admin/bookings/` | Needs verification |
| Admin delivery | `app/admin/delivery/` | Needs verification |
| Admin revenue | `app/admin/revenue/` | Needs verification |
| Admin outreach | `app/admin/outreach/` | Needs verification |
| Admin notifications | `app/admin/notifications/` | Needs verification |
| Admin settings | `app/admin/settings/` | Needs verification |
| Admin social | `app/admin/social/` | Needs verification |
| Admin content | `app/admin/content/` | Needs verification |
| Relevance AI panel | `app/admin/relevance-ai/` | Needs verification |

### Team portal
| Feature | Route | Status |
|---------|-------|--------|
| Team dashboard | `app/team/dashboard/` | Needs verification |
| Team pipeline | `app/team/pipeline/` | Needs verification |
| Team clients | `app/team/clients/` | Needs verification |
| Team tasks | `app/team/tasks/` | Needs verification |
| Team QA | `app/team/qa/` | Needs verification |
| Team delivery | `app/team/delivery/` | Needs verification |
| Team agent runs | `app/team/agent-runs/` | Needs verification |
| Team notes | `app/team/notes/` | Needs verification |
| Team notifications | `app/team/notifications/` | Needs verification |
| Team ops | `app/team/ops/` | Needs verification |
| Team outreach | `app/team/outreach/` | Needs verification |
| Team audits | `app/team/audits/` | Needs verification |
| Team billing status | `app/team/billing-status/` | Needs verification |
| Team projects | `app/team/projects/` | Needs verification |
| Team settings | `app/team/settings/` | Needs verification |

### Demo
| Feature | Route | Status |
|---------|-------|--------|
| Demo flow | `app/demo/page.tsx` | Needs verification |
| Demo widget sandbox | `app/demo/widget/page.tsx` | Needs verification |

### Integrations (confirmed in lib/)
| Integration | Location | Status |
|------------|---------|--------|
| Supabase (DB + Auth) | `lib/supabase/` | Confirmed present |
| Stripe payments | `lib/stripe/` | Needs verification |
| Resend email | `lib/resend/` | Needs verification |
| Cal.com booking | `lib/calcom/` | Needs verification |
| WhatsApp Business | `lib/whatsapp/` | Needs verification |
| Relevance AI agents | `lib/relevance/` | Needs verification |
| Anthropic Claude | `lib/ai/` | Needs verification |
| Upstash rate limiting | `lib/rate-limit/` | Needs verification |
| PostHog analytics | (package confirmed) | Needs verification |
| Sentry monitoring | (config files confirmed) | Needs verification |

---

## Planned features

These are intended for future builds based on the offer packages in [[02-offers-and-pricing]] and agent designs in [[04-agent-workflows]].

- Full AI agent orchestration via Relevance AI (live runs)
- Automated client onboarding flow (agent-driven)
- WhatsApp follow-up sequences
- Monthly optimization report generation
- Client-facing progress/status view
- Advanced Mission Control analytics

---

## Features needing approval

These have been discussed but not formally approved:

- White-label client portals
- Public API for third-party integrations
- Native mobile dashboard app
- Automated cold outreach system

---

## Features not aligned right now

Do not build these — they do not fit current strategy or are premature:

- Generic AI chatbot builder (not aligned with agency model)
- Social media scheduling tool
- Email marketing platform
- Project management tool (competing with delivery system scope)

---

## Deprecated or paused ideas

- `helios-ai-landing` (older HTML/CSS/JSX prototype) — superseded by `helios-ai-next`
- Any features from the original static landing page codebase
