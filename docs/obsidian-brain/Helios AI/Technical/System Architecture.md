# System Architecture

## Summary

High-level architecture for Helios AI. This is the **business-facing** view; the code-confirmed stack with evidence lives in [[05-tech-stack]].

## Current status

`In progress` — built on Next.js + Supabase, hosted on Netlify. Admin login-gating and some integrations are still pending; assumed items are marked `Needs verification` in [[05-tech-stack]].

## Preferred stack (intended)

| Layer | Technology |
|---|---|
| Frontend | Next.js |
| Styling | Tailwind CSS |
| Backend runtime | Node.js |
| Hosting | Netlify |
| Database | PostgreSQL (via Supabase) |
| Data layer | Supabase client |
| Auth | Supabase Auth (future protected admin) |
| Payments | PayPal |
| Agent platform | Relevance AI |
| Email | Google Workspace / possible Resend later |
| Analytics | possible Google Analytics / PostHog later |

> **Note (verified):** the codebase uses **Supabase (Postgres) directly — not Prisma**, and **Supabase Auth — not Auth0**. The "Prisma / Auth0" idea was an earlier assumption; see [[05-tech-stack]] and [[08-decision-log]] for the confirmed reality.

## Important technical notes

- Do **not** expose API keys in frontend code.
- Store sensitive keys in **Netlify environment variables**.
- Relevance AI calls should go through a **backend/serverless route**.
- PayPal verification must happen **server-side**.
- Admin routes should eventually be **protected**; the landing page stays **public**.
- Mission Control should be **login-gated**.
- Audit submissions should be **stored before** agent processing.
- **Failed agent runs should be logged** (the audit processor already saves failed runs).

## Key decisions

- Keys server-side only; never `NEXT_PUBLIC_` for secrets.
- Public landing page vs login-gated admin is a hard boundary.

## Action items

- [ ] Add login gating to admin / Mission Control
- [ ] Confirm all secrets live in Netlify env, not code
- [ ] Keep agent + payment calls server-side

## See also

[[05-tech-stack]] · [[Relevance AI]] · [[PayPal]] · [[Mission Control]] · [[Email Setup]]

---
*Last updated: 2026-05-29*
