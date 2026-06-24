# Helios AI — Security Guardrails

Mandatory rules for any work that touches leads, clients, roles, auth, payments, or AI. Read this before building Mission Control / AIOS features. These rules are enforcement, not suggestions — a single violation can leak one team member's data to another or expose a secret.

Related: [`docs/supabase-schema-management.md`](./supabase-schema-management.md) · `lib/data/scoped-leads.ts` · `lib/auth/permissions.ts`

---

## 1. Lead reads must go through the scoped data-access layer

Any query against **`research_leads`, `research_runs`, `admin_outreach_leads`, `admin_clients`, saved leads, or outreach leads** must go through the canonical scoped layer in [`lib/data/scoped-leads.ts`](../lib/data/scoped-leads.ts):

- `getScopedResearchLeads(session, filters?)`
- `getScopedResearchLeadById(session, leadId)`
- `getScopedOutreachLeads(session, filters?)`
- `getScopedOutreachLeadById(session, leadId)`
- `getScopedLeadStats(session)`
- `assertCanAccessLead(session, lead)` / `canAccessLead(session, lead)`

**Why:** per-agent isolation is enforced in application code, not the database. RLS on these tables is founder-only; agents read via the service-role client, which bypasses RLS. The scoped layer is the only place that applies `leadScopeFor()` correctly. Do not hand-write `supabase.from('research_leads')...` in a page, API route, or new data file.

**If a direct query is genuinely unavoidable** (e.g. a founder-only aggregate, or a run-history read that has its own scoping): you MUST (a) call `leadScopeFor(session.role, session.teamMemberId)` and apply the `created_by_team_member_id` / `saved_by_team_member_id` filter when `!viewAll`, and (b) leave a code comment explaining why it isn't using the scoped layer. The existing run reads in `lib/data/admin-research.ts` (`getResearchRuns`, `getResearchRunDetail`) and the founder-only aggregates (`getOutreachSummary`, `getRetainerHealth`, `getTeamActivity`) are the only sanctioned direct queries today.

## 2. Founder/admin can see all agency data

`founder_admin` has `viewAll = true` — full read of every agency lead, client, run, and aggregate. Founder-only surfaces (clients, billing, team activity, retainer health, mission-control financials) are gated by route (`/admin/clients`, `/admin/team`, etc. are NOT in the outreach allowlist) and by `requireFounderAdmin()` / `requireAdmin()` returning founder-only for those paths.

## 3. Workers / outreach agents see ONLY their own leads

`outreach_agent` sees only rows it **saved, created, or was assigned** (`saved_by_team_member_id` / `created_by_team_member_id` = its `team_members.id`). Assignment is not modeled in the schema yet; do not invent an `assigned_to` column — `canAccessLead` already checks it harmlessly if one is ever added. A non-UUID team member id (dev mock) fails closed. Any other role is denied entirely.

## 4. Never rely on frontend role checks alone

UI hiding (nav filtering, conditional buttons) is a convenience, never the gate. Every read, mutation, and API route must re-derive the role from `team_members` server-side via a `require*` guard and re-check. The frontend can lie; the server cannot trust it.

## 5. Never expose service-role Supabase access to client components

`createServiceRoleClient()` is server-only (dynamic `require`, never exported from `lib/supabase/client.ts`). It must never be imported into a `'use client'` component, a client-bundled module, or anything reachable from the browser. Client components use the anon-key browser client (`lib/supabase/client.ts`) only. The `SUPABASE_SERVICE_ROLE_KEY` env var must never carry a `NEXT_PUBLIC_` prefix.

## 6. No AI agent sends outreach automatically without human approval

AI may **draft** outreach (first DMs, cold-email openings, research angles) but must never **send** to an agency prospect without an explicit human action. The Research Agent generates templates only; the Client Outreach pipeline is 100% manual. The client-facing chat/WhatsApp assistant (which the client's own customers talk to) auto-replies, but is gated by business-level and conversation-level `ai_paused` flags and human handoff — that is a different system from Helios → prospect outreach. When building AIOS agents, preserve the **draft → human approve → send** boundary; never wire an agent to contact agency prospects on its own.

## 7. Keep agency sales leads separate from product/client-side leads

Two distinct lead concepts — do not conflate them:

- **Agency sales CRM** (Helios's own prospecting): `admin_leads`, `admin_outreach_leads`, `research_leads`. Per-agent scoped.
- **Product/client-side leads** (a client business's captured customers): `leads`. Scoped by `business_id` via the client's own membership, not by Helios team member.

A Mission Control widget that mixes these is a bug. Be explicit about which one you mean.

## 8. Keep manual agency billing separate from product subscription billing

- **Agency billing** (what a client pays Helios): manual, founder-set fields on `admin_clients` (`setup_fee`, `monthly_fee`, `retainer_status`, payment events). Always labelled "Estimated"; never frontend-settable as "paid" by a client.
- **Product subscription billing** (a client's plan on the Helios product): driven only by signed Stripe webhooks → `subscriptions`. Status is server-authoritative; never let the frontend set subscription status.

Do not merge these into one "revenue" number without saying which is which.

---

## Quick checklist before merging any lead/admin feature

- [ ] Every lead read uses `lib/data/scoped-leads.ts` (or has a commented, `leadScopeFor`-applied exception).
- [ ] No new `'use client'` file imports `createServiceRoleClient` or a `server-only` data module.
- [ ] Every API route / server action re-checks role with a `require*` guard.
- [ ] No new secret carries `NEXT_PUBLIC_`.
- [ ] No AI path sends to a prospect without a human action.
- [ ] Agency vs product leads, and agency vs product billing, are not conflated.
- [ ] `npm run type-check`, `npm run lint`, and `npm run build` all pass.
