# Mission Control Route Map

> Discovery and documentation pass only. No routes are being moved, renamed, or deleted by this document. Every row below is the current state of the repository as-is, with a recommendation against the target architecture.

## Target architecture (reference)

| Surface | Route base | Audience | Status today |
|---|---|---|---|
| Public Website | `/` | Prospects, visitors | Exists |
| Client Portal | `/client/*` | Business owners using Helios AI | Exists (Phase 29) |
| Mission Control | `/admin/mission-control` | Founder + admins (command center) | **Not built yet** |
| Ops Panel | `/team/ops` | Internal team workspace (future) | **Not built yet** — `/team/*` exists from Phase 29 as a precursor |

## Legend

- **Owner**: where the route belongs in the target architecture.
- **Status**:
  - `already aligned` — route is in the right place and needs no change.
  - `needs navigation update` — route works but is linked from the wrong nav.
  - `needs auth guard` — route is missing a guard or has the wrong guard.
  - `needs data source change` — route currently reads from a scope that won't match its new owner.
  - `needs user decision` — there is more than one defensible target and the user must pick.
- **Removal permission required**: `yes` if any work toward the target involves removing or hiding a working feature for an existing audience. `no` if work is purely additive.

---

## 1. Public Website (`app/(public)/*` and root)

| Current route | Current purpose | Current files | New owner | New target route | Status | Removal permission required |
|---|---|---|---|---|---|---|
| `/` | Marketing homepage (hero, features, pricing, FAQ, CTA) | `app/(public)/page.tsx`, `components/landing/*` | public | `/` | already aligned | no |
| `/pricing` | Public pricing page (Starter / Booking OS / Ops Center) | `app/(public)/pricing/page.tsx`, `components/landing/PricingSection.tsx` | public | `/pricing` | already aligned | no |
| `/how-it-works` | Marketing — 5-stage explainer | `app/(public)/how-it-works/page.tsx` | public | `/how-it-works` | already aligned | no |
| `/industries` | Marketing — industries served | `app/(public)/industries/page.tsx` | public | `/industries` | already aligned | no |
| `/audit` | Lead-magnet free audit CTA | `app/(public)/audit/page.tsx` | public | `/audit` | already aligned | no |
| `/choose-plan` | Plan picker that routes to registration | `app/(public)/choose-plan/page.tsx` | public | `/choose-plan` | already aligned | no |
| `/register-business` | Business registration form (17 fields) | `app/(public)/register-business/page.tsx`, `app/(public)/register-business/RegistrationForm.tsx`, `lib/actions/registration.ts`, `lib/validation/registration.ts` | public | `/register-business` | already aligned | no |
| `/register-business/submitted` | Confirmation page after registration | `app/(public)/register-business/submitted/page.tsx` | public | `/register-business/submitted` | already aligned | no |
| `/demo` | Public live-chat demo for prospects | `app/demo/page.tsx` | public | `/demo` | already aligned | no |
| `/demo/widget` | Embeddable widget demo for prospects | `app/demo/widget/page.tsx` | public | `/demo/widget` | already aligned | no |
| `/login` | Client login (Supabase password auth) | `app/(auth)/login/page.tsx`, `app/(auth)/layout.tsx`, `components/auth/LoginForm.tsx`, `lib/auth/actions.ts` | client | `/login` | already aligned | no |
| `/signup` | Client signup | `app/(auth)/signup/page.tsx`, `components/auth/SignupForm.tsx` | client | `/signup` | already aligned | no |
| `/auth/callback` | Supabase OAuth/email confirmation callback | `app/auth/callback/route.ts` | client | `/auth/callback` | already aligned | no |
| `/booking/[token]` | Tokenized public booking confirmation/decline | `app/booking/[token]/page.tsx`, `app/api/booking/[token]/confirm/route.ts`, `app/api/booking/[token]/reject/route.ts` | public | `/booking/[token]` | already aligned | no |

---

## 2. Legacy Dashboard (`app/dashboard/*`)

This is the original Phase 1–28 power-user dashboard. It mixes business-owner workflows (services, widget, bookings) with founder/admin tools (Ops Center, AI agents, audits, templates). The Phase 29 separation has begun mirroring some of these into `/client/*` but the legacy routes have **not been removed** and are still the primary working surface today.

| Current route | Current purpose | Current files | New owner | New target route | Status | Removal permission required |
|---|---|---|---|---|---|---|
| `/dashboard` | "Mission Control" overview — KPIs, attention panel, live activity, agent runs, plan usage, setup progress, launch readiness, deployment score, niche template card, demo mode | `app/dashboard/page.tsx`, `app/dashboard/mission-control/*.tsx` (13 widgets) | admin | `/admin/mission-control` | needs user decision (full move) | yes |
| `/dashboard/business` | Business profile editor (name, hours, contact, location) | `app/dashboard/business/page.tsx` | client | mirrored at `/client/business-profile` (currently a stub linking back here); target = full editor in `/client/business-profile` | needs data source change | needs decision — leave as legacy or deep-mirror |
| `/dashboard/services` | Service catalog CRUD | `app/dashboard/services/page.tsx` | client | `/client/knowledge-base` and/or new `/client/services` | needs user decision | needs decision |
| `/dashboard/leads` | Lead CRM (list, status, contact, owner) | `app/dashboard/leads/page.tsx` | client | `/client/leads` (currently a stub) | needs data source change | needs decision |
| `/dashboard/bookings` | Booking list, confirm/decline, escalation | `app/dashboard/bookings/page.tsx`, `lib/actions/bookings.ts` | client | `/client/bookings` (currently a stub) | needs data source change | needs decision |
| `/dashboard/inbox` | Inbound conversation inbox (chat + WhatsApp) | `app/dashboard/inbox/page.tsx`, `app/dashboard/inbox/InboxUnreadBadge.tsx`, `lib/actions/inbox.ts` | client | `/client/conversations` (currently a stub) | needs data source change | needs decision |
| `/dashboard/agents` | AI agent runs viewer (Anthropic + Relevance) | `app/dashboard/agents/page.tsx`, `lib/actions/agents.ts` | admin | `/admin/mission-control/agents` (or sub-tab) | needs auth guard, needs user decision | yes |
| `/dashboard/audits` | Business audit workspace (scoring + recommendations) | `app/dashboard/audits/page.tsx`, `lib/actions/audits.ts`, `lib/audits/*` | admin | `/admin/mission-control/audits` (founder-facing); `/team/ops/audits` if delegated to internal team | needs user decision | yes |
| `/dashboard/ops` | Ops Center (events, tasks, alerts, approvals, SLA, automations, webhook logs) | `app/dashboard/ops/page.tsx`, `app/dashboard/ops/OpsCenterClient.tsx`, `lib/actions/ops.ts`, `lib/ops/*` | admin (founder ops) and/or team | `/admin/mission-control/ops` for founder oversight; `/team/ops` for daily team work | needs user decision (split or shared) | yes |
| `/dashboard/calcom` | Cal.com integration setup | `app/dashboard/calcom/page.tsx`, `lib/calcom/client.ts`, `lib/actions/calcom.ts` | client | mirrored into `/client/settings` or `/client/business-profile` | needs navigation update | needs decision |
| `/dashboard/widget` | Embed widget settings + snippet | `app/dashboard/widget/page.tsx`, `lib/actions/widget.ts` | client | mirrored into `/client/settings` | needs navigation update | needs decision |
| `/dashboard/whatsapp` | WhatsApp Cloud API setup + templates | `app/dashboard/whatsapp/page.tsx`, `lib/whatsapp/*`, `lib/actions/whatsapp.ts` | client | mirrored into `/client/settings` | needs navigation update | needs decision |
| `/dashboard/templates` | Niche template library (founder tool) | `app/dashboard/templates/page.tsx`, `lib/templates/niche-templates.ts`, `lib/actions/templates.ts` | admin | `/admin/mission-control/templates` | needs user decision | yes |
| `/dashboard/onboarding` | Onboarding intake form (client) | `app/dashboard/onboarding/page.tsx`, `lib/actions/onboarding.ts` | client | `/client/settings` or `/client/dashboard` initial flow | needs navigation update | needs decision |
| `/dashboard/delivery` | Delivery progress tracker (per-client) | `app/dashboard/delivery/page.tsx`, `lib/actions/delivery.ts` | client (visible to client) and team (internal) | `/client/dashboard` widget + `/team/ops/delivery` | needs user decision (dual or split) | needs decision |
| `/dashboard/setup` | Setup guide / onboarding checklist | `app/dashboard/setup/page.tsx` | client | `/client/dashboard` (embedded) or `/client/setup` | needs navigation update | needs decision |
| `/dashboard/settings` | Account settings hub | `app/dashboard/settings/page.tsx`, `lib/actions/settings.ts` | client | `/client/settings` (currently a stub) | needs data source change | needs decision |
| `/dashboard/settings/billing` | Stripe subscription, invoices, plan switch | `app/dashboard/settings/billing/page.tsx`, `lib/actions/billing.ts`, `lib/billing/*`, `lib/stripe/client.ts` | client | `/client/billing` (currently a stub) | needs data source change | needs decision |
| `/dashboard/chat-test` | Internal chat-sandbox for QA | `app/dashboard/chat-test/page.tsx` | admin or team | `/admin/mission-control/chat-test` or `/team/ops/chat-test` | needs user decision | yes |

**Guard today**: `app/dashboard/layout.tsx` calls `supabase.auth.getUser()` and redirects to `/login` if absent. There is **no role-based restriction** between business-owner and founder tools — anyone logged in with a business membership can see everything under `/dashboard`. The middleware additionally redirects `/dashboard` to `/login` when no user is present.

---

## 3. Client Portal (`app/client/*`)

Built in Phase 29. Layout enforces `requireClient()` which loads the user's `business_members` row and selects the right business. All routes here are guarded by `lib/auth/require-client.ts` and additionally by `middleware.ts` (line 50-ish: `pathname.startsWith('/client') && !user` → redirect to `/login`).

| Current route | Current purpose | Current files | New owner | New target route | Status | Removal permission required |
|---|---|---|---|---|---|---|
| `/client` | Redirects to `/client/dashboard` | `app/client/page.tsx` | client | `/client` | already aligned | no |
| `/client/dashboard` | Client home — welcome + 7-day KPI placeholders + quick links | `app/client/dashboard/page.tsx` | client | `/client/dashboard` | needs data source change (KPIs are zero-state today) | no |
| `/client/business-profile` | Read-only business summary, link back to `/dashboard/business` | `app/client/business-profile/page.tsx` | client | `/client/business-profile` | needs data source change (deep-mirror the legacy editor) | no |
| `/client/ai-assistant` | AI status panel (placeholder values: "Active", "0 replies", "Auto-reply") | `app/client/ai-assistant/page.tsx` | client | `/client/ai-assistant` | needs data source change | no |
| `/client/leads` | Empty-state list; defers to `/dashboard/leads` | `app/client/leads/page.tsx` | client | `/client/leads` | needs data source change | no |
| `/client/bookings` | Empty-state; defers to `/dashboard/bookings` | `app/client/bookings/page.tsx` | client | `/client/bookings` | needs data source change | no |
| `/client/conversations` | Empty-state | `app/client/conversations/page.tsx` | client | `/client/conversations` | needs data source change | no |
| `/client/knowledge-base` | Empty-state; defers to `/dashboard/services` | `app/client/knowledge-base/page.tsx` | client | `/client/knowledge-base` | needs data source change | no |
| `/client/reports` | Zero-state KPI cards + plan-gated insight panels | `app/client/reports/page.tsx` | client | `/client/reports` | needs data source change | no |
| `/client/billing` | "Current plan" card + link to `/dashboard/settings/billing` | `app/client/billing/page.tsx` | client | `/client/billing` | needs data source change | no |
| `/client/support` | Email link + setup link | `app/client/support/page.tsx` | client | `/client/support` | already aligned | no |
| `/client/settings` | Read-only profile rows + link to `/dashboard/settings` | `app/client/settings/page.tsx` | client | `/client/settings` | needs data source change | no |

**Plan gating**: every `/client/*` page wraps content in `<PlanGate>` which consults `lib/plans/plan-access.ts`. Starter/Booking OS/Ops Center each unlock progressively more pages. Locked pages render a "Plan upgrade required" panel instead of the content.

---

## 4. Team Portal (`app/team/*` — Phase 29 precursor to Ops Panel)

Built in Phase 29 with five roles (`founder_admin`, `sales`, `delivery`, `support`, `analyst`). The route base will likely be **renamed to `/team/ops`** per the target architecture, OR `/team/*` becomes the umbrella with `/team/ops` as a sub-route.

| Current route | Current purpose | Current files | New owner | New target route | Status | Removal permission required |
|---|---|---|---|---|---|---|
| `/team` | Redirect to `/team/dashboard` | `app/team/page.tsx` | team | `/team` (umbrella) or `/team/ops` | needs user decision | needs decision |
| `/team/login` | Internal team Supabase login | `app/team/login/page.tsx`, `app/team/login/TeamLoginForm.tsx` | team | `/team/login` | already aligned | no |
| `/team/dashboard` | Team-wide stats (pipeline, projects, agent runs) | `app/team/dashboard/page.tsx` | team | `/team/ops` or `/team/ops/dashboard` | needs navigation update | needs decision |
| `/team/pipeline` | Sales pipeline | `app/team/pipeline/page.tsx` | team | `/team/ops/pipeline` | needs navigation update | needs decision |
| `/team/audits` | Internal audit queue (registration requests) | `app/team/audits/page.tsx` | team | `/team/ops/audits` | needs navigation update | needs decision |
| `/team/agent-runs` | Agent run history for QA/analytics | `app/team/agent-runs/page.tsx` | team | `/team/ops/agent-runs` | needs navigation update | needs decision |
| `/team/outreach` | Outreach campaigns | `app/team/outreach/page.tsx` | team | `/team/ops/outreach` | needs navigation update | needs decision |
| `/team/clients` | Internal client roster | `app/team/clients/page.tsx` | team | `/team/ops/clients` | needs navigation update | needs decision |
| `/team/projects` | Delivery projects | `app/team/projects/page.tsx` | team | `/team/ops/projects` | needs navigation update | needs decision |
| `/team/delivery` | Stage-by-stage delivery tracker | `app/team/delivery/page.tsx` | team | `/team/ops/delivery` | needs navigation update | needs decision |
| `/team/qa` | Cross-client QA checks | `app/team/qa/page.tsx` | team | `/team/ops/qa` | needs navigation update | needs decision |
| `/team/notes` | Internal notes | `app/team/notes/page.tsx` | team | `/team/ops/notes` | needs navigation update | needs decision |
| `/team/notifications` | Audit submissions, alerts | `app/team/notifications/page.tsx` | team | `/team/ops/notifications` | needs navigation update | needs decision |
| `/team/billing-status` | Subscription health across clients | `app/team/billing-status/page.tsx` | team | `/team/ops/billing-status` | needs navigation update | needs decision |
| `/team/tasks` | Outstanding team tasks | `app/team/tasks/page.tsx` | team | `/team/ops/tasks` | needs navigation update | needs decision |
| `/team/settings` | Team member profile + role view | `app/team/settings/page.tsx` | team | `/team/ops/settings` | needs navigation update | needs decision |

**Guard today**: `app/team/layout.tsx` reads `x-pathname` from headers and skips the guard for `/team/login`. All other paths run `requireTeam()` which loads `team_members` (table is expected; falls back to mock data when not provisioned). `middleware.ts` redirects `/team/*` (except `/team/login`) to `/team/login` when no user is present.

---

## 5. Admin / Mission Control (`/admin/*`) — Pass 30 scaffold

Built in Pass 30 as a protected founder command center. **No legacy `/dashboard/*` route has been migrated, redirected, or removed.** Each admin page is either a self-contained shell (mock data) or surfaces a link back to the working legacy surface.

**Status legend for admin pages:**
- `shell` — fully self-contained page with mock data; no dependency on `/dashboard/*`.
- `linked` — shell page that includes a prominent legacy link out to `/dashboard/*` where real data lives.
- `functional` — wired to real Supabase / live data (none yet).

| Current route | Current purpose | Current files | New owner | New target route | Status | Removal permission required |
|---|---|---|---|---|---|---|
| `/admin` | Redirect → `/admin/mission-control` | `app/admin/page.tsx` | admin | `/admin` | shell, already aligned | no |
| `/admin/mission-control` | Founder command center — 10 KPI cards + 10 preview panels (audits, leads, clients, outreach, Relevance, content, social, bookings, notifications, revenue, delivery) | `app/admin/mission-control/page.tsx`, `components/admin/AdminPreviewCard.tsx` | admin | `/admin/mission-control` | shell, linked (via preview panels to legacy `/dashboard/*`) | no |
| `/admin/audits` | Audit inbox table | `app/admin/audits/page.tsx` | admin | `/admin/audits` | linked → `/dashboard/audits` | no |
| `/admin/leads` | Lead pipeline table | `app/admin/leads/page.tsx` | admin | `/admin/leads` | linked → `/dashboard/leads` | no |
| `/admin/outreach` | Outreach campaign cards | `app/admin/outreach/page.tsx` | admin | `/admin/outreach` | shell | no |
| `/admin/clients` | Active client roster | `app/admin/clients/page.tsx` | admin | `/admin/clients` | linked → `/dashboard/business` | no |
| `/admin/relevance-ai` | Agent run history | `app/admin/relevance-ai/page.tsx` | admin | `/admin/relevance-ai` | linked → `/dashboard/agents` | no |
| `/admin/content` | Marketing content pipeline | `app/admin/content/page.tsx` | admin | `/admin/content` | shell | no |
| `/admin/social` | Social posting schedule | `app/admin/social/page.tsx` | admin | `/admin/social` | shell | no |
| `/admin/bookings` | Strategy call schedule | `app/admin/bookings/page.tsx` | admin | `/admin/bookings` | linked → `/dashboard/bookings` | no |
| `/admin/notifications` | Founder-facing alerts | `app/admin/notifications/page.tsx` | admin | `/admin/notifications` | shell | no |
| `/admin/delivery` | Active project cards | `app/admin/delivery/page.tsx` | admin | `/admin/delivery` | linked → `/dashboard/delivery` | no |
| `/admin/revenue` | Setup + retainer + active subs snapshot | `app/admin/revenue/page.tsx` | admin | `/admin/revenue` | linked → `/dashboard/settings/billing` | no |
| `/admin/settings` | Founder profile + bootstrap note | `app/admin/settings/page.tsx` | admin | `/admin/settings` | shell | no |

**Guard today**: `app/admin/layout.tsx` calls `requireAdmin()` (`lib/auth/require-admin.ts`). This wraps `requireTeam()` and additionally checks `role === 'founder_admin'`. Non-admin roles are redirected to `/team/dashboard?error=admin_only`. Middleware (`middleware.ts`) redirects `/admin/*` to `/team/login` when no Supabase user is present.

**Founder bootstrap**: Until a row exists in `team_members` with `role='founder_admin'` for the founder's Supabase user, `/admin/*` is reachable only in dev with `HELIOS_ENABLE_MOCK_AUTH=true` (mock session has role=founder_admin). Production seed:

```sql
INSERT INTO team_members (user_id, role, full_name, email)
VALUES ('<supabase-user-id>', 'founder_admin', '<name>', '<email>');
```

---

## 6. API routes (`app/api/*`)

API routes are not the audience-facing UI but their owners matter for future ACL changes. Listed only at the category level — no recommendation to move any of them.

| Category | Routes | Current owner | Notes |
|---|---|---|---|
| Chat | `/api/chat` | shared | Used by widget, dashboard chat-test, demo. Keep server-side. |
| Stripe | `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook` | shared | Driven by `/client/billing` (target) and `/dashboard/settings/billing` (legacy). |
| Cal.com | `/api/calcom/event-types`, `/api/calcom/availability`, `/api/calcom/book`, `/api/webhooks/calcom` | client | Used by booking flow + dashboard config. |
| WhatsApp | `/api/whatsapp/send`, `/api/whatsapp/send-template`, `/api/webhooks/whatsapp` | client | Used by inbox + WhatsApp dashboard. |
| Widget | `/api/widget/config`, `/api/analytics/widget` | client | Public widget reads config; analytics post-back. |
| Relevance | `/api/relevance/agents`, `/api/relevance/workforces`, `/api/relevance/run-agent`, `/api/relevance/run-workforce`, `/api/relevance/runs/[runId]`, `/api/relevance/webhook` | admin/team | Founder + team use. Keep server-side. |
| Ops | `/api/ops/export`, `/api/ops/sla/run`, `/api/ops/notifications/preview`, `/api/ops/notifications/test`, `/api/ops/notifications/retry`, `/api/ops/notifications/process-pending`, `/api/ops/notification-previews/export` | admin/team | Currently behind `/dashboard/ops` — same auth posture moves with the page. |
| Cron | `/api/cron/ops/sla`, `/api/cron/bookings/expire-confirmations` | system | Bearer-token auth. Owner-agnostic. Netlify scheduled functions call these. |
| Booking | `/api/booking/[token]/confirm`, `/api/booking/[token]/reject` | public | Owner-token gated public endpoint. |

---

## 7. Auth & guard summary

| Surface | Layout guard file | Middleware behavior |
|---|---|---|
| Public | none | passes through |
| `/login`, `/signup` | `app/(auth)/layout.tsx` | redirects to `/dashboard` if already signed in |
| `/dashboard/*` | `app/dashboard/layout.tsx` → `supabase.auth.getUser()` | `middleware.ts` redirects to `/login` if no user |
| `/client/*` | `app/client/layout.tsx` → `requireClient()` (`lib/auth/require-client.ts`) | `middleware.ts` redirects to `/login` if no user |
| `/team/*` (except `/team/login`) | `app/team/layout.tsx` → `requireTeam()` (`lib/auth/require-team.ts`) | `middleware.ts` redirects to `/team/login` if no user |
| `/admin/*` | `app/admin/layout.tsx` → `requireAdmin()` (`lib/auth/require-admin.ts`) — role must be `founder_admin` | `middleware.ts` redirects to `/team/login` if no user |

Auth helpers:
- `lib/auth/actions.ts` — `login`, `signup`, `logout` server actions (shared by client + team login forms).
- `lib/auth/types.ts` — `ClientSession`, `TeamSession`, role unions (`founder_admin` lives in `TeamRole`).
- `lib/auth/permissions.ts` — role rank, route allowlist, `clientOwnsBusiness`, `makeTeamActionStamp`, `founderCanAccessAdminRoute`.
- `lib/auth/require-client.ts` / `require-team.ts` / `require-admin.ts` — server-only guards.
- `lib/auth/mock-session.ts` — dev fallback; production short-circuits to real Supabase.

Navigation components:
- `components/landing/Nav.tsx` — public marketing nav. Uses `NAV_LINKS` from `lib/constants/index.ts` (now points at `/how-it-works`, `/industries`, `/pricing`, `/audit`).
- `components/dashboard/Sidebar.tsx` — legacy dashboard sidebar (consumes `DASHBOARD_NAV` constant). Mixes business + founder routes.
- `components/client-portal/ClientSidebar.tsx` — client portal sidebar (consumes `CLIENT_NAV` from `ClientNav.ts`). Plan-gated.
- `components/team-portal/TeamSidebar.tsx` — team portal sidebar (consumes `TEAM_NAV` from `TeamNav.ts`). Role-filtered via `teamCanAccessRoute`.
- `components/admin/AdminSidebar.tsx` — admin sidebar (consumes `ADMIN_NAV` from `AdminNav.ts`). Only renders for `founder_admin`.

---

## Summary

- **103 routes** total in the repository after Pass 30 (was 89).
- **14 routes** under `/admin/*` are the new founder Mission Control surface, all guarded by `requireAdmin()` (`founder_admin` only).
- **18 routes** under `/dashboard/*` remain the primary working surface for Phase 1–28.
- **12 routes** under `/client/*` are Phase 29 stubs that defer most editing back to `/dashboard/*`.
- **16 routes** under `/team/*` are Phase 29 scaffolding; the target `/team/ops` route base is unbuilt.
- **No** routes have been removed, redirected, or renamed in Pass 30. The legacy dashboard is the source of truth.
