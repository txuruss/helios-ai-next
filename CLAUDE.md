# Helios AI Agency — Claude Code Guide

## Before making any changes

Read the Obsidian Brain source-of-truth files first:

- [`docs/obsidian-brain/00-source-of-truth.md`](docs/obsidian-brain/00-source-of-truth.md) — Core operating rules
- [`docs/obsidian-brain/07-claude-code-rules.md`](docs/obsidian-brain/07-claude-code-rules.md) — Code rules for every session
- [`docs/obsidian-brain/03-mission-control.md`](docs/obsidian-brain/03-mission-control.md) — Mission Control structure and confirmed routes

See [`docs/obsidian-brain/index.md`](docs/obsidian-brain/index.md) for the full knowledge base.

---

## Non-negotiable rules

- **Do not break existing features.** Read files before editing them. Preserve all existing routes, components, and API handlers.
- **Do not hallucinate.** If something is not confirmed in the codebase or brain, write "Needs verification" — do not invent it.
- **Inspect before editing.** Use the Read tool before any Edit or Write.
- **Keep changes scoped.** Fix what was asked. Do not refactor, clean up, or expand scope without approval.
- **Never delete without approval.** No files, routes, tables, or dependencies removed without explicit user instruction.
- **Ask before changing architecture.** Auth, payments, database schema, API routes, middleware, and hosting config require explicit approval.

---

## After completing work, always provide

1. Files modified (with paths)
2. What changed (one sentence per file)
3. Test steps the user can follow to verify the change
4. Assumptions made
5. Open questions or items marked "Needs verification"

---

## Project structure (quick reference)

```
helios-ai-next/
├── app/
│   ├── (auth)/           — Login, signup
│   ├── (public)/         — Landing, pricing, audit, register
│   ├── admin/            — Internal admin + Mission Control
│   ├── dashboard/        — Client-facing dashboard
│   ├── team/             — Team portal
│   ├── client/           — Client workspace
│   ├── demo/             — Demo flow
│   └── api/              — API routes (protect these)
├── lib/                  — All shared logic (supabase, stripe, ai, etc.)
├── components/           — Shared UI components
├── supabase/             — SQL migrations and schema
├── docs/                 — Documentation
│   └── obsidian-brain/   — The project knowledge base (this brain)
└── CLAUDE.md             — This file
```

---

## Confirmed tech stack (short form)

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database + Auth:** Supabase
- **Payments:** PayPal (primary; configured via PAYPAL_CLIENT_ID/SECRET). Stripe backend remains as legacy and is being phased out.
- **Email:** Resend
- **AI/LLM:** Anthropic Claude (`@anthropic-ai/sdk`)
- **Booking:** Cal.com
- **WhatsApp:** Meta WhatsApp Business API
- **Agents:** Relevance AI (partial — see `docs/obsidian-brain/09-open-questions.md`)
- **Monitoring:** Sentry
- **Analytics:** PostHog
- **Hosting:** Netlify (primary)

Full confirmed vs assumed stack: [`docs/obsidian-brain/05-tech-stack.md`](docs/obsidian-brain/05-tech-stack.md)
