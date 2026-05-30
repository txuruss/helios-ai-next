# Decision Log — Helios AI Agency

See also: [[00-source-of-truth]] | [[10-feature-map]] | [[09-open-questions]]

This log tracks every major project decision: what was decided, why, current status, and what it affects. Update this whenever a significant architectural, product, or process decision is made.

> **Business direction:** [[Helios AI/Strategy/Decision Log]] holds business/strategic decisions in plain language. This note stays canonical for **decisions with codebase evidence** (tech, architecture, build).

---

## How to use this log

| Field | What to write |
|-------|--------------|
| Date | YYYY-MM-DD format |
| Decision | The decision made, stated clearly |
| Reason | Why this decision was made |
| Status | Active / Superseded / Paused / Reversed |
| Impact | What this affects going forward |
| Related | Links to relevant files or notes |

Mark superseded decisions with a ~~strikethrough~~ and add a note pointing to the replacement decision.

---

## Decision table

| Date | Decision | Reason | Status | Impact | Related |
|------|----------|--------|--------|--------|---------|
| 2026-05-22 | Helios AI Agency is the active project source of truth | The project is being reset and centralized to avoid confusion from multiple previous projects. All future prompts, code changes, and documentation must follow this brain first. | Active | All Claude Code sessions must read this brain before acting. Previous project names, structures, or conventions are superseded. | [[00-source-of-truth]] |
| 2026-05-22 | Supabase is the confirmed database and auth layer (not PostgreSQL/Prisma or Auth0) | Inspection of codebase confirms `@supabase/supabase-js`, `lib/supabase/`, `supabase/schema.sql`, and Supabase env vars. No Prisma config or Auth0 config found. | Active | Do not write Prisma queries. Do not reference Auth0. Use `lib/supabase/` client for all database and auth operations. | [[05-tech-stack]] |
| 2026-05-22 | Netlify is the primary hosting target (not Vercel) | `netlify.toml` and `netlify/` directory exist. However `vercel.json` also exists — this is an open question. Netlify is treated as primary until confirmed otherwise. | Active | Do not write Vercel-specific features (Edge Middleware patterns, Vercel KV, etc.) without clarification. | [[05-tech-stack]], [[09-open-questions]] |
| 2026-05-22 | Relevance AI integration is present but full production status is unconfirmed | `lib/relevance/` and env vars exist. `app/admin/relevance-ai/page.tsx` exists. However whether agents are actively running in production is not confirmed from code inspection alone. | Active | Do not assume Relevance AI agents are live. Mark all agent workflow builds as planned until confirmed. | [[04-agent-workflows]], [[09-open-questions]] |
| 2026-05-22 | Obsidian Brain created as project source of truth | Project needed a centralized knowledge base to prevent hallucinations, inconsistent branding, and lost decisions across sessions. | Active | All future Claude Code sessions should reference this brain before making changes. | [[README]], [[07-claude-code-rules]] |
| 2026-05-29 | Start client outreach before PayPal and Relevance AI are finished | Validate demand and land a first paying client rather than overbuild automation. The website is live and has working lead capture, which is enough to sell. | Active | Outreach is not blocked by unfinished PayPal/Relevance AI. First client may be delivered manually. | [[Client Acquisition Readiness]], [[Outreach Strategy]], [[Risks]] |
| 2026-05-29 | Live domain confirmed: heliosai.agency | The website is deployed and reachable at https://heliosai.agency/. Audit form, "Get Free Audit" CTA, and admin/Mission Control exist. | Active | Use heliosai.agency as the canonical domain. Contact email is hello@heliosai.agency; Instagram is heliosai.agency. | [[HQ]], [[Email Setup]], [[Website Improvement Backlog]] |
| 2026-05-29 | Confirmed public pricing (Starter $997/$149, Booking OS $2,500/$399, Ops Center $5,000/$999) | Founder set the price points; a $1,000–$1,500 first-client offer is used to validate demand. | Active | Reflect these on the live pricing page; confirm CTAs route correctly. | [[Pricing]], [[02-offers-and-pricing]] |
| 2026-05-29 | Relevance AI manual "Run AI Audit" processor built but NOT connected | A founder-triggered audit analysis action exists in code (`/admin/audits`), saving structured results; env vars are unset so it is not live. Deferred until after outreach starts. | Active | Do not mark Relevance AI as connected. Set RELEVANCE_AI_* env vars + apply migration to enable. Decision-support only — no auto-outreach/auto-conversion. | [[Relevance AI]], [[04-agent-workflows]] |
| 2026-05-29 | PayPal deferred; no checkout/verification built | Payment integration is not required to validate demand. First client can be invoiced/paid manually. | Active | Do not mark PayPal complete; revenue stays "Estimated." Verification must be server-side when built. No fake verification. | [[PayPal]], [[05-tech-stack]] |

---

## Adding new decisions

When a significant decision is made, add a row to the table above. Decision-worthy events include:

- Choosing one technology over another
- Deciding to build or not build a feature
- Changing the offer structure or pricing
- Changing the agent design
- Deciding on a delivery process change
- Reversing or superseding a previous decision
- Confirming a previously open question (also update [[09-open-questions]])
