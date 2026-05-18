# Mission Control Feature Review

> Discovery and documentation pass only. No feature is being removed, hidden, or moved by this document. Every "Recommended action" is a proposal that the founder must approve before any implementation work begins. When in doubt, the recommendation defaults to **keep as legacy route** so nothing breaks.

## Target architecture (reference)

- **Public Website** — prospects and visitors.
- **Client Portal** (`/client/*`) — business owners using Helios AI.
- **Mission Control** (`/admin/mission-control`) — founder + admin command center. **Not built yet.**
- **Ops Panel** (`/team/ops`) — internal team workspace. **Not built yet** (current `/team/*` is a Phase 29 precursor).

## Legend

- **Recommended action**: `keep`, `move to admin`, `move to client portal`, `move to team ops`, `keep as legacy route`, `hide from client navigation only`, `request permission to remove`.
- **User permission required**: `yes` if the action affects an existing audience (founder, client, or team). `no` for purely additive work like building a new admin shell.

---

## A. Marketing & public site features

### A1. Marketing homepage
- **Current route**: `/`
- **Current files**: `app/(public)/page.tsx`, `components/landing/LandingPage.tsx`, `components/landing/Hero.tsx`, `components/landing/PricingSection.tsx`, `components/landing/FAQSection.tsx`, `components/landing/Footer.tsx`, `components/landing/Nav.tsx`
- **Current purpose**: Public conversion page with hero, problem statement, how-it-works, features, trust, social proof, pricing, FAQ, CTA.
- **Why it may not align**: Aligns fully.
- **Recommended action**: keep.
- **Risk if removed**: Total loss of public lead acquisition. Cannot be removed.
- **User permission required**: yes (any change to public site).

### A2. Public sub-pages
- **Current route**: `/pricing`, `/how-it-works`, `/industries`, `/audit`, `/choose-plan`
- **Current files**: `app/(public)/pricing/page.tsx`, `app/(public)/how-it-works/page.tsx`, `app/(public)/industries/page.tsx`, `app/(public)/audit/page.tsx`, `app/(public)/choose-plan/page.tsx`
- **Current purpose**: Marketing sub-pages that convert into registration.
- **Why it may not align**: Aligned.
- **Recommended action**: keep.
- **Risk if removed**: Reduced funnel coverage and lost SEO surface.
- **User permission required**: yes.

### A3. Business registration funnel
- **Current route**: `/register-business`, `/register-business/submitted`
- **Current files**: `app/(public)/register-business/page.tsx`, `app/(public)/register-business/RegistrationForm.tsx`, `app/(public)/register-business/submitted/page.tsx`, `lib/actions/registration.ts`, `lib/validation/registration.ts`
- **Current purpose**: 17-field business registration that creates a pending `business_audits` row and triggers Relevance AI placeholder.
- **Why it may not align**: Aligned.
- **Recommended action**: keep.
- **Risk if removed**: Audit queue + new client intake stops working.
- **User permission required**: yes.

### A4. Public booking demo & widget demo
- **Current route**: `/demo`, `/demo/widget`
- **Current files**: `app/demo/page.tsx`, `app/demo/widget/page.tsx`
- **Current purpose**: Live preview of the widget for prospects; used during sales calls.
- **Why it may not align**: Aligned — public-facing.
- **Recommended action**: keep.
- **Risk if removed**: Loss of a key sales demo asset.
- **User permission required**: yes.

### A5. Tokenized booking confirmation
- **Current route**: `/booking/[token]`
- **Current files**: `app/booking/[token]/page.tsx`, `app/api/booking/[token]/confirm/route.ts`, `app/api/booking/[token]/reject/route.ts`, `lib/bookings/confirmation.ts`
- **Current purpose**: Public endpoint a customer hits via emailed link to confirm or decline a tentative booking.
- **Why it may not align**: Aligned — public token flow.
- **Recommended action**: keep.
- **Risk if removed**: Booking confirmations break; pending appointments expire silently.
- **User permission required**: yes.

---

## B. Auth features

### B1. Client login / signup / callback
- **Current route**: `/login`, `/signup`, `/auth/callback`
- **Current files**: `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/auth/callback/route.ts`, `app/(auth)/layout.tsx`, `components/auth/LoginForm.tsx`, `components/auth/SignupForm.tsx`, `lib/auth/actions.ts`
- **Current purpose**: Supabase email/password auth for business owners.
- **Why it may not align**: Aligned.
- **Recommended action**: keep.
- **Risk if removed**: No client access at all.
- **User permission required**: yes.

### B2. Team login
- **Current route**: `/team/login`
- **Current files**: `app/team/login/page.tsx`, `app/team/login/TeamLoginForm.tsx` (reuses `lib/auth/actions.ts`)
- **Current purpose**: Internal team Supabase login that redirects to `/team/dashboard` on success.
- **Why it may not align**: If `/team/*` becomes `/team/ops`, the login should probably stay at `/team/login` (umbrella) and redirect into `/team/ops` after auth.
- **Recommended action**: keep (path likely unchanged even when sub-pages move).
- **Risk if removed**: No team access at all.
- **User permission required**: yes.

---

## C. Legacy dashboard features (`/dashboard/*`)

These are the Phase 1–28 features. All are live and working today and are the **primary** working surface for users. The recommendations below assume eventual migration, but the safe default is "keep as legacy route" until each replacement is built and validated.

### C1. Mission Control overview (`/dashboard`)
- **Current route**: `/dashboard`
- **Current files**: `app/dashboard/page.tsx`, all 13 widgets in `app/dashboard/mission-control/*` (KpiCard, AttentionRequiredPanel, LiveActivityFeed, ClientSystemHealth, AgentWorkforceSnapshot, PlanUsageCard, SetupProgressCard, DemoModeCard, AiReviewCard, LaunchReadinessCard, ClientOnboardingCard, DeploymentScoreCard, NicheTemplateCard)
- **Current purpose**: Founder/admin command-center overview — KPIs, alerts, agent activity, system health, plan usage, setup readiness, deployment score, audit/template state.
- **Why it may not align**: The page is named "Mission Control" and bundles **admin-only** widgets (Agent Workforce, Deployment Score, Client Onboarding, Niche Template) into the **business-owner** dashboard. A Starter client should not see Agent Workforce or Deployment Score; a founder needs them.
- **Recommended action**: move to admin (target: `/admin/mission-control`) — but **keep current route working** until the new admin shell is built and the founder has signed off.
- **Risk if removed**: Founder loses the daily overview; clients lose their landing page after login.
- **User permission required**: yes — major UX change for both audiences.

### C2. Business profile editor
- **Current route**: `/dashboard/business`
- **Current files**: `app/dashboard/business/page.tsx`, `lib/actions/business.ts`
- **Current purpose**: Edit business name, hours, contact, location. Drives the AI assistant's grounding.
- **Why it may not align**: Owned by business owners — belongs in client portal. Phase 29 created a stub at `/client/business-profile` that links back here.
- **Recommended action**: move to client portal (deep-mirror into `/client/business-profile`); keep `/dashboard/business` as legacy until the mirror is fully functional.
- **Risk if removed**: Business owners cannot edit their profile → AI assistant has stale data.
- **User permission required**: yes.

### C3. Service catalog
- **Current route**: `/dashboard/services`
- **Current files**: `app/dashboard/services/page.tsx`, `lib/actions/services.ts`
- **Current purpose**: CRUD for service offerings (used in chat replies, booking flow, FAQ training).
- **Why it may not align**: Client-owned data. Currently lives in legacy dashboard.
- **Recommended action**: move to client portal (target: `/client/services` or merged into `/client/knowledge-base`); keep as legacy until mirrored.
- **Risk if removed**: Customers can no longer manage services. Chat replies degrade.
- **User permission required**: yes.

### C4. Leads CRM
- **Current route**: `/dashboard/leads`
- **Current files**: `app/dashboard/leads/page.tsx`, `lib/actions/leads.ts`
- **Current purpose**: Lead list, statuses (new/qualified/contacted/proposal/won/lost), assignment, notes.
- **Why it may not align**: Client-owned data. Phase 29 stub at `/client/leads` is zero-state only.
- **Recommended action**: move to client portal; keep as legacy until mirrored.
- **Risk if removed**: Owners cannot work their pipeline.
- **User permission required**: yes.

### C5. Bookings management
- **Current route**: `/dashboard/bookings`
- **Current files**: `app/dashboard/bookings/page.tsx`, `lib/actions/bookings.ts`, `lib/validation/bookings.ts`, `lib/bookings/confirmation.ts`
- **Current purpose**: Tentative + confirmed bookings; confirm/decline buttons; expiry timer.
- **Why it may not align**: Client-owned. Currently in legacy dashboard.
- **Recommended action**: move to client portal; keep as legacy until mirrored.
- **Risk if removed**: Owners cannot confirm bookings → revenue impact.
- **User permission required**: yes.

### C6. Inbox (conversations)
- **Current route**: `/dashboard/inbox`
- **Current files**: `app/dashboard/inbox/page.tsx`, `app/dashboard/inbox/InboxUnreadBadge.tsx`, `lib/actions/inbox.ts`
- **Current purpose**: Unified inbox across website chat + WhatsApp; human takeover; unread badge.
- **Why it may not align**: Client-owned. Phase 29 stub at `/client/conversations` is empty.
- **Recommended action**: move to client portal; keep as legacy until mirrored.
- **Risk if removed**: Owners cannot take over conversations or read history.
- **User permission required**: yes.

### C7. AI Agents viewer
- **Current route**: `/dashboard/agents`
- **Current files**: `app/dashboard/agents/page.tsx`, `lib/actions/agents.ts`
- **Current purpose**: View Anthropic + Relevance AI agent runs, status, output.
- **Why it may not align**: Founder/admin tool. Clients should not see internal agent infrastructure.
- **Recommended action**: move to admin (target: `/admin/mission-control/agents`); **hide from client navigation only** in the interim (legacy route still reachable to founder).
- **Risk if removed**: Founder loses agent debugging surface.
- **User permission required**: yes.

### C8. Audits workspace
- **Current route**: `/dashboard/audits`
- **Current files**: `app/dashboard/audits/page.tsx`, `lib/actions/audits.ts`, `lib/audits/scoring.ts`, `lib/audits/recommendations.ts`, `lib/validation/audits.ts`
- **Current purpose**: Manual audit scoring + recommendations for a business; produces the report the team sends to the client.
- **Why it may not align**: This is an internal team + founder workflow, not a client surface. Audits **also** appear at `/team/audits` (Phase 29 placeholder).
- **Recommended action**: move to admin (founder dashboard) and team ops (team workspace) — likely both, with different views; keep as legacy until built.
- **Risk if removed**: Auditing pipeline breaks. Sales loses its key deliverable.
- **User permission required**: yes.

### C9. Ops Center
- **Current route**: `/dashboard/ops`
- **Current files**: `app/dashboard/ops/page.tsx`, `app/dashboard/ops/OpsCenterClient.tsx`, plus many sub-components (SlaRoutingPanel, OpsAuditTrail, AutomationRuleDrawer, NotificationRuleDrawer, SlaPolicyDrawer), `lib/actions/ops.ts`, `lib/ops/*` (events, sla, audit, automation, notifications, notification-delivery, webhook-logs, cron)
- **Current purpose**: Operations command center — events, tasks, alerts, approvals, SLA policies, notification rules, automation rules, audit trail, webhook logs, cron health.
- **Why it may not align**: This is the most ambiguous one. Today it's bundled with the client-facing dashboard but it's clearly an operator surface. It is **client Ops Center** (per `lib/plans/plan-access.ts` it unlocks on the Ops Center plan) *and* an internal admin/team surface depending on viewer.
- **Recommended action**: needs user decision. Two viable shapes:
  - (a) Split: a slimmer client-facing Ops Center under `/client/ops` (Ops Center plan only) and a fuller `/admin/mission-control/ops` and/or `/team/ops/ops` for founders/team.
  - (b) Keep one Ops Center and role-gate the deep features.
  - For now: **keep as legacy route**.
- **Risk if removed**: Loses the entire operations command surface — biggest single feature in the app.
- **User permission required**: yes.

### C10. Cal.com integration
- **Current route**: `/dashboard/calcom`
- **Current files**: `app/dashboard/calcom/page.tsx`, `lib/calcom/client.ts`, `lib/actions/calcom.ts`, `lib/validation/calcom.ts`
- **Current purpose**: Connect Cal.com account, pick event types, manage availability.
- **Why it may not align**: Client setting. Should live under `/client/settings`.
- **Recommended action**: move to client portal (`/client/settings/calcom` or similar); keep as legacy until mirrored.
- **Risk if removed**: Booking integration breaks.
- **User permission required**: yes.

### C11. Embed widget
- **Current route**: `/dashboard/widget`
- **Current files**: `app/dashboard/widget/page.tsx`, `lib/actions/widget.ts`, `lib/validation/widget.ts`
- **Current purpose**: Widget config (colors, position, welcome message); embed snippet copy-out.
- **Why it may not align**: Client setting.
- **Recommended action**: move to client portal; keep as legacy until mirrored.
- **Risk if removed**: Owners cannot get their embed code → cannot install the widget.
- **User permission required**: yes.

### C12. WhatsApp configuration
- **Current route**: `/dashboard/whatsapp`
- **Current files**: `app/dashboard/whatsapp/page.tsx`, `lib/whatsapp/client.ts`, `lib/whatsapp/templates.ts`, `lib/actions/whatsapp.ts`, `lib/validation/whatsapp.ts`
- **Current purpose**: WhatsApp Cloud API token, phone number, template management.
- **Why it may not align**: Client setting.
- **Recommended action**: move to client portal; keep as legacy until mirrored.
- **Risk if removed**: WhatsApp assistant cannot be configured.
- **User permission required**: yes.

### C13. Niche templates
- **Current route**: `/dashboard/templates`
- **Current files**: `app/dashboard/templates/page.tsx`, `lib/templates/niche-templates.ts`, `lib/actions/templates.ts`, `lib/validation/templates.ts`
- **Current purpose**: Founder library of niche-specific prompt + service templates for fast client setup.
- **Why it may not align**: Internal tool, not a client setting. Clients see an applied template through their AI assistant, not the catalog.
- **Recommended action**: move to admin (target: `/admin/mission-control/templates`); **hide from client navigation only** in the interim.
- **Risk if removed**: Founder loses fast-setup tooling.
- **User permission required**: yes.

### C14. Onboarding intake
- **Current route**: `/dashboard/onboarding`
- **Current files**: `app/dashboard/onboarding/page.tsx`, `lib/actions/onboarding.ts`, `lib/validation/onboarding.ts`
- **Current purpose**: Onboarding intake form (post-signup deep questionnaire).
- **Why it may not align**: Client step. Could merge with the public registration form long-term.
- **Recommended action**: move to client portal (`/client/dashboard` first-run flow); keep as legacy until mirrored.
- **Risk if removed**: New-client setup quality drops.
- **User permission required**: yes.

### C15. Delivery tracker
- **Current route**: `/dashboard/delivery`
- **Current files**: `app/dashboard/delivery/page.tsx`, `lib/actions/delivery.ts`, `lib/validation/delivery.ts`
- **Current purpose**: Per-client delivery progress (kickoff → build → QA → launch → optimization).
- **Why it may not align**: Dual-audience. Client wants visibility into their own delivery; team uses the same data to manage workload.
- **Recommended action**: needs user decision — likely a client-facing card on `/client/dashboard` and a full team view at `/team/ops/delivery`. Keep as legacy until both built.
- **Risk if removed**: Loses delivery visibility for both audiences.
- **User permission required**: yes.

### C16. Setup guide
- **Current route**: `/dashboard/setup`
- **Current files**: `app/dashboard/setup/page.tsx`, `lib/validation/setup.ts`, `lib/actions/setup.ts`
- **Current purpose**: Setup wizard / launch readiness checklist.
- **Why it may not align**: Client onboarding tool.
- **Recommended action**: move to client portal (embed in `/client/dashboard` or split to `/client/setup`); keep as legacy until mirrored.
- **Risk if removed**: New clients lose their guided path.
- **User permission required**: yes.

### C17. Account settings
- **Current route**: `/dashboard/settings`
- **Current files**: `app/dashboard/settings/page.tsx`, `lib/actions/settings.ts`, `lib/validation/schemas.ts`
- **Current purpose**: Account profile, notification preferences, security.
- **Why it may not align**: Client setting.
- **Recommended action**: move to client portal (`/client/settings`); keep as legacy until mirrored.
- **Risk if removed**: Owners cannot manage account info.
- **User permission required**: yes.

### C18. Billing
- **Current route**: `/dashboard/settings/billing`
- **Current files**: `app/dashboard/settings/billing/page.tsx`, `lib/actions/billing.ts`, `lib/billing/plans.ts`, `lib/billing/limits.ts`, `lib/stripe/client.ts`, `lib/validation/billing.ts`
- **Current purpose**: Stripe subscription, invoices, plan switch, payment method.
- **Why it may not align**: Client setting.
- **Recommended action**: move to client portal (`/client/billing`); keep as legacy until mirrored.
- **Risk if removed**: Owners cannot manage subscriptions or invoices.
- **User permission required**: yes.

### C19. Chat test sandbox
- **Current route**: `/dashboard/chat-test`
- **Current files**: `app/dashboard/chat-test/page.tsx`
- **Current purpose**: Internal/QA chat sandbox — test the AI assistant with synthetic inputs.
- **Why it may not align**: Clients shouldn't see internal QA tools.
- **Recommended action**: hide from client navigation only — move to admin or team ops (target: `/admin/mission-control/chat-test` or `/team/ops/chat-test`). Keep as legacy route reachable to staff.
- **Risk if removed**: Loses an internal QA tool. Low business impact.
- **User permission required**: yes.

---

## D. Client portal features (`/client/*`)

All Phase 29 stubs. Most defer to `/dashboard/*` today.

### D1. Client dashboard
- **Current route**: `/client/dashboard`
- **Current files**: `app/client/dashboard/page.tsx`
- **Current purpose**: Welcome + 7-day KPI tiles (zero-state) + four quick-link cards.
- **Why it may not align**: KPIs are hard-coded zero — needs real data from `business_id` scope.
- **Recommended action**: keep — wire up real data sources as part of the client migration pass.
- **Risk if removed**: Removes the post-login landing page for clients.
- **User permission required**: yes (any change to the client home).

### D2. Client business profile
- **Current route**: `/client/business-profile`
- **Current files**: `app/client/business-profile/page.tsx`
- **Current purpose**: Read-only summary + link to `/dashboard/business`.
- **Why it may not align**: Stub — doesn't deep-mirror the legacy editor yet.
- **Recommended action**: keep (target audience correct); promote to full editor as part of migration.
- **Risk if removed**: Client loses any view of their business profile.
- **User permission required**: yes.

### D3. AI assistant status
- **Current route**: `/client/ai-assistant`
- **Current files**: `app/client/ai-assistant/page.tsx`
- **Current purpose**: AI status panel — currently placeholder values.
- **Why it may not align**: Needs real signals from `chat_sessions`, `agent_runs`, pause flag.
- **Recommended action**: keep; wire up to live data.
- **Risk if removed**: Clients lose AI status visibility.
- **User permission required**: yes.

### D4. Client leads / bookings / conversations / knowledge-base / reports / billing / support / settings
- **Current route**: `/client/leads`, `/client/bookings`, `/client/conversations`, `/client/knowledge-base`, `/client/reports`, `/client/billing`, `/client/support`, `/client/settings`
- **Current files**: corresponding `app/client/<route>/page.tsx`
- **Current purpose**: Zero-state pages that defer back to `/dashboard/*` equivalents.
- **Why it may not align**: Stubs. Need real data scoping by `business_id`.
- **Recommended action**: keep all; flesh out as part of migration.
- **Risk if removed**: Removes the cleaner business-owner-friendly UX direction.
- **User permission required**: yes.

---

## E. Team portal features (`/team/*`)

Built in Phase 29 with mock data. Will likely move under `/team/ops` per the target architecture.

### E1. Team dashboard
- **Current route**: `/team/dashboard`
- **Current files**: `app/team/dashboard/page.tsx`
- **Current purpose**: Team-wide overview — active pipeline, projects, agent runs, pipeline value.
- **Why it may not align**: Likely lives at `/team/ops` as the entry view in the new architecture.
- **Recommended action**: move to team ops (rename to `/team/ops` or `/team/ops/dashboard`).
- **Risk if removed**: Team loses its home page.
- **User permission required**: yes.

### E2. Pipeline
- **Current route**: `/team/pipeline`
- **Current files**: `app/team/pipeline/page.tsx`
- **Current purpose**: Sales pipeline table — deals across stages.
- **Why it may not align**: Should live under `/team/ops/pipeline`.
- **Recommended action**: move to team ops.
- **Risk if removed**: Sales loses pipeline view.
- **User permission required**: yes.

### E3. Internal audits queue
- **Current route**: `/team/audits`
- **Current files**: `app/team/audits/page.tsx`
- **Current purpose**: Internal queue of registration-driven audits (pending → in_review → sent).
- **Why it may not align**: Should live under `/team/ops/audits`. Also overlaps with `/dashboard/audits` (legacy).
- **Recommended action**: move to team ops.
- **Risk if removed**: Audit pipeline visibility lost.
- **User permission required**: yes.

### E4. Agent runs (team view)
- **Current route**: `/team/agent-runs`
- **Current files**: `app/team/agent-runs/page.tsx`
- **Current purpose**: History of Relevance AI runs for QA/analytics.
- **Why it may not align**: Should live under `/team/ops/agent-runs`. Overlaps with `/dashboard/agents` (legacy founder view).
- **Recommended action**: move to team ops (consider mirroring a slice to admin Mission Control).
- **Risk if removed**: Team loses agent QA surface.
- **User permission required**: yes.

### E5. Outreach
- **Current route**: `/team/outreach`
- **Current files**: `app/team/outreach/page.tsx`
- **Current purpose**: Outreach campaign performance.
- **Why it may not align**: Should live under `/team/ops/outreach`.
- **Recommended action**: move to team ops.
- **Risk if removed**: Sales loses outreach visibility.
- **User permission required**: yes.

### E6. Team Clients roster
- **Current route**: `/team/clients`
- **Current files**: `app/team/clients/page.tsx`
- **Current purpose**: Roster of paying clients with monthly stats.
- **Why it may not align**: Should live under `/team/ops/clients`.
- **Recommended action**: move to team ops.
- **Risk if removed**: Team loses internal client list.
- **User permission required**: yes.

### E7. Projects & Delivery (team)
- **Current route**: `/team/projects`, `/team/delivery`
- **Current files**: `app/team/projects/page.tsx`, `app/team/delivery/page.tsx`
- **Current purpose**: Active delivery projects + stage-kanban view.
- **Why it may not align**: Should live under `/team/ops/*`. Same data as `/dashboard/delivery` but team-scoped.
- **Recommended action**: move to team ops.
- **Risk if removed**: Delivery loses team-wide visibility.
- **User permission required**: yes.

### E8. QA
- **Current route**: `/team/qa`
- **Current files**: `app/team/qa/page.tsx`
- **Current purpose**: Cross-client QA checks (widget, WhatsApp, Cal.com, notifications, bookings).
- **Why it may not align**: Should live under `/team/ops/qa`. Overlaps with `/dashboard/chat-test` (single-client tool).
- **Recommended action**: move to team ops.
- **Risk if removed**: Team loses QA dashboard.
- **User permission required**: yes.

### E9. Notes
- **Current route**: `/team/notes`
- **Current files**: `app/team/notes/page.tsx`
- **Current purpose**: Internal notes (placeholder).
- **Why it may not align**: Empty placeholder. Should live under `/team/ops/notes`.
- **Recommended action**: move to team ops.
- **Risk if removed**: Removes a future surface; no current users.
- **User permission required**: yes.

### E10. Notifications
- **Current route**: `/team/notifications`
- **Current files**: `app/team/notifications/page.tsx`
- **Current purpose**: Audit submissions, deal updates, system alerts (placeholder today).
- **Why it may not align**: Should live under `/team/ops/notifications`. Different from `/dashboard/ops` notification rules (those are policy config).
- **Recommended action**: move to team ops.
- **Risk if removed**: Team loses alert surface.
- **User permission required**: yes.

### E11. Billing status (team)
- **Current route**: `/team/billing-status`
- **Current files**: `app/team/billing-status/page.tsx`
- **Current purpose**: Subscription health across all clients.
- **Why it may not align**: Should live under `/team/ops/billing-status`.
- **Recommended action**: move to team ops.
- **Risk if removed**: Team loses billing visibility.
- **User permission required**: yes.

### E12. Team tasks
- **Current route**: `/team/tasks`
- **Current files**: `app/team/tasks/page.tsx`
- **Current purpose**: Outstanding internal task list.
- **Why it may not align**: Should live under `/team/ops/tasks`.
- **Recommended action**: move to team ops.
- **Risk if removed**: Team loses task surface.
- **User permission required**: yes.

### E13. Team settings
- **Current route**: `/team/settings`
- **Current files**: `app/team/settings/page.tsx`
- **Current purpose**: Team member profile and role view.
- **Why it may not align**: Should live under `/team/ops/settings`.
- **Recommended action**: move to team ops.
- **Risk if removed**: Team loses self-service profile view.
- **User permission required**: yes.

---

## F. Cross-cutting infrastructure

These are not "pages" but support every feature above. None are candidates for removal.

### F1. Auth helpers and guards
- **Current files**: `lib/auth/types.ts`, `lib/auth/permissions.ts`, `lib/auth/mock-session.ts`, `lib/auth/require-client.ts`, `lib/auth/require-team.ts`, `lib/auth/actions.ts`
- **Recommended action**: keep. When `/admin/mission-control` is built, add a sibling `lib/auth/require-admin.ts`. **Permission required**: no (additive only).

### F2. Plan access helper
- **Current files**: `lib/plans/plan-access.ts`
- **Recommended action**: keep. Drives `/client/*` plan gating today. Will be reused when client billing migrates. **Permission required**: no.

### F3. Relevance AI service
- **Current files**: `lib/relevance/client.ts`, `lib/relevance/relevance-service.ts`
- **Recommended action**: keep. **Permission required**: no.

### F4. Ops engine
- **Current files**: `lib/ops/events.ts`, `lib/ops/sla.ts`, `lib/ops/audit.ts`, `lib/ops/automation.ts`, `lib/ops/notifications.ts`, `lib/ops/notification-delivery.ts`, `lib/ops/webhook-logs.ts`, `lib/ops/cron.ts`, `lib/actions/ops.ts`, `lib/types/ops.ts`, `lib/validation/ops.ts`
- **Recommended action**: keep regardless of where the Ops Center UI ends up. **Permission required**: no.

### F5. Middleware
- **Current files**: `middleware.ts`
- **Recommended action**: keep — add an `/admin/*` branch when Mission Control is built. **Permission required**: no.

### F6. Cron infrastructure
- **Current files**: `netlify/functions/ops-sla-cron.ts`, `netlify/functions/booking-expiry-cron.ts`, `app/api/cron/*`
- **Recommended action**: keep. **Permission required**: no.

### F7. Mock data
- **Current files**: `lib/data/mock-businesses.ts`, `lib/data/mock-team.ts`
- **Recommended action**: keep until real data flows in. **Permission required**: no.

---

## Route map summary

- **89 routes total**; 18 under `/dashboard/*` and 12 under `/client/*` overlap in audience and need a migration pass before legacy `/dashboard/*` can be retired.
- **5 founder-only features** are currently bundled with the client surface: Mission Control overview (`/dashboard`), AI Agents (`/dashboard/agents`), Audits (`/dashboard/audits`), Templates (`/dashboard/templates`), and parts of Ops Center (`/dashboard/ops`). All should eventually move to `/admin/mission-control` but **none should be removed before the new surface exists**.
- **13 client-owned features** under `/dashboard/*` need deep-mirroring into `/client/*` (business profile, services, leads, bookings, inbox, calcom, widget, whatsapp, onboarding, delivery, setup, settings, billing).
- **16 team features** under `/team/*` will likely move under `/team/ops/*` once the Ops Panel name is finalized.

## Feature review summary

| Recommendation | Count | Notes |
|---|---:|---|
| `keep` | 17 | Public site, auth, infrastructure |
| `move to admin` | 4 | Mission Control overview, agents, templates, audits founder view |
| `move to client portal` | 11 | Business profile, services, leads, bookings, inbox, calcom, widget, whatsapp, onboarding, setup, settings, billing |
| `move to team ops` | 13 | All `/team/*` pages, plus future team views of audits/agents/delivery |
| `hide from client navigation only` | 2 | Templates, chat-test (still reachable to founder/team during transition) |
| `keep as legacy route` | 18 | Every `/dashboard/*` route during the migration period |
| `request permission to remove` | 0 | **No removals recommended in this pass.** |

## Potential risks

1. **Single working surface today is `/dashboard/*`.** Any move-or-hide action before a fully-built replacement risks breaking real user workflows. The `/client/*` mirrors are stubs.
2. **Ops Center ambiguity.** `/dashboard/ops` is both a client-paid feature (Ops Center plan in `lib/plans/plan-access.ts`) and an internal admin/team surface. Splitting it cleanly requires a founder decision on what the **client** Ops Center is vs. what the **internal** Ops Panel is.
3. **Two "Mission Control" concepts.** Today `/dashboard` is internally called "Mission Control" in the page title. The target architecture introduces a different "Mission Control" at `/admin/mission-control`. Without disambiguation, audit/PR descriptions will be confusing.
4. **Audits live in three places.** `/dashboard/audits` (legacy founder workflow), `/team/audits` (Phase 29 internal queue), and the new `business_audits` table created by `lib/actions/registration.ts`. These need reconciling before any move.
5. **Delivery tracker is dual-audience.** Splitting it cleanly between client visibility and team operations needs careful schema work.
6. **Team table not provisioned yet.** `requireTeam()` falls back to mock data when `team_members` doesn't exist. Real team auth needs a migration before `/team/*` work can leave the placeholder state.
7. **No `/admin` route exists.** Scaffolding it requires a new layout, sidebar, guard (`require-admin.ts`), and a middleware branch. None of this is started.

## Recommended next implementation pass

In strict order, so each phase ships behind real auth and on real data:

1. **Decide the Mission Control vs. Ops Panel split.** Founder confirms which features in `/dashboard/ops` are client-facing (Ops Center plan) vs. internal-only.
2. **Scaffold `/admin/mission-control`** as an empty admin shell with its own layout, `requireAdmin()` guard, and `admin_members` (or reuse `team_members.role = 'founder_admin'`) gating. Build only the redirect + auth flow first — no widgets moved yet.
3. **Move Mission Control widgets** from `app/dashboard/mission-control/*` to `app/admin/mission-control/*`, keeping legacy `/dashboard` as a thin redirect for founders during the cutover.
4. **Move founder-only features**: AI Agents, Templates, Audits-founder-view, Chat-test → `/admin/mission-control/*`. Each move keeps the legacy URL working (redirect) until the founder confirms.
5. **Rename `/team/*` to `/team/ops/*`** (or restructure with `/team` as umbrella and `/team/ops` as the workspace). Add proper team member provisioning.
6. **Deep-mirror client features into `/client/*`** — one feature at a time, with the legacy `/dashboard/*` route kept as the source of truth until each mirror is feature-complete and validated.
7. **Retire `/dashboard/*` routes one at a time**, each behind an explicit founder approval that the replacement is production-ready. No batched removal; no removal without permission.

**Do not implement Mission Control yet.** This document is discovery only.

---

## Pass 30 update — Mission Control scaffold landed

Implementation pass 30 created the `/admin/*` surface as a **safe scaffold** alongside the legacy dashboard. **No removals, no redirects, no migrations.** All recommendations in this document still stand; this section only records what shipped.

### New routes
- `/admin` (redirect → `/admin/mission-control`)
- `/admin/mission-control` — founder command center: 10 KPI cards (audits today, leads, active clients, follow-ups, agent runs, booked calls, delivery tasks, setup revenue, estimated MRR, alerts) + 10 preview panels.
- `/admin/audits`, `/admin/leads`, `/admin/outreach`, `/admin/clients`, `/admin/relevance-ai`, `/admin/content`, `/admin/social`, `/admin/bookings`, `/admin/notifications`, `/admin/delivery`, `/admin/revenue`, `/admin/settings` — shell pages, each linking back to the working legacy `/dashboard/*` route where applicable.

### New auth surface
- `lib/auth/require-admin.ts` — thin wrapper over `requireTeam()` adding a `role === 'founder_admin'` check.
- `lib/auth/permissions.ts` — added `founderCanAccessAdminRoute()`.
- `middleware.ts` — added `/admin/*` redirect to `/team/login` for unauthenticated users.

### What did NOT change
- No `/dashboard/*` route was removed, renamed, redirected, or moved.
- No `/dashboard/mission-control/*` widget was moved.
- No `/client/*` or `/team/*` route was altered.
- No API route was touched.
- No database schema or RLS policy was changed.
- No live external API (Stripe, Supabase, Relevance, Cal.com, WhatsApp, Anthropic, PostHog, Sentry, Resend) was newly called.

### New questionable alignment items discovered

None. The Pass 30 build did not surface any new ambiguities beyond what is already documented above.

### Founder bootstrap (required before production access)

Until the production `team_members` table has a row with `role='founder_admin'` for the founder's Supabase user, `/admin/*` is unreachable in production (middleware redirects to `/team/login`; the team layout then redirects to `/team/login?error=not_authorized`). In dev environments, setting `HELIOS_ENABLE_MOCK_AUTH=true` unlocks `/admin/*` via the mock session (which is `founder_admin` by default).

```sql
-- Run once in production after the founder has signed up via /signup
INSERT INTO team_members (user_id, role, full_name, email)
VALUES ('<supabase-user-id>', 'founder_admin', '<name>', '<email>');
```
