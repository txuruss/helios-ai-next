# Tech Stack — Helios AI Agency

See also: [[00-source-of-truth]] | [[09-open-questions]] | [[07-claude-code-rules]]

> **Business direction:** [[Helios AI/Technical/System Architecture]] is the business-level stack view. This note stays canonical for **confirmed-vs-assumed code facts and evidence**.

---

## Preferred stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Component library | Custom (Lucide React for icons) |
| Backend/runtime | Node.js (via Next.js API routes) |
| Hosting/compute | Netlify (primary) |
| Database | Supabase (PostgreSQL) |
| ORM/data layer | Supabase client (not Prisma) |
| Auth | Supabase Auth |
| Rate limiting | Upstash Redis |
| File/blob storage | Needs verification — see below |
| Monitoring/APM | Sentry |
| Product analytics | PostHog |
| Web analytics | Needs verification |
| Transactional email | Resend |
| Payments | PayPal (primary); Stripe (legacy backend) |
| AI/LLM | Anthropic Claude (via `@anthropic-ai/sdk`) |
| Booking | Cal.com |
| WhatsApp | Meta WhatsApp Business API |
| Automation/agents | Relevance AI (planned/partial — see below) |
| CI/CD | Needs verification |

---

## Confirmed vs Assumed Stack

This section documents what is confirmed from actual codebase files versus what is intended but unverified.

### Confirmed (visible in codebase)

| Technology | Evidence |
|-----------|---------|
| Next.js | `package.json` — `"next": "^16.2.6"` |
| React 19 | `package.json` — `"react": "^19.2.6"` |
| TypeScript | `tsconfig.json`, `.tsx` files throughout |
| Tailwind CSS | `tailwind.config.ts`, `postcss.config.mjs`, `package.json` |
| Framer Motion | `package.json` — `"framer-motion": "^11.18.2"` |
| Supabase (database + auth) | `@supabase/supabase-js` in `package.json`; `lib/supabase/`; `.env.example` vars |
| Sentry | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`; `@sentry/nextjs` |
| PostHog | `package.json` — `"posthog-js": "^1.373.4"` |
| Resend | `.env.example` — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; `lib/resend/` |
| Stripe | `package.json` — `"stripe": "^22.1.1"`; `lib/stripe/`; `.env.example` |
| Anthropic Claude SDK | `package.json` — `"@anthropic-ai/sdk": "^0.96.0"`; `lib/ai/` |
| Cal.com | `.env.example` — `CALCOM_API_KEY`; `lib/calcom/` |
| WhatsApp Business API | `.env.example` — `META_ACCESS_TOKEN`, `WHATSAPP_*` vars; `lib/whatsapp/` |
| Upstash Redis (rate limiting) | `package.json` — `@upstash/ratelimit`, `@upstash/redis`; `lib/rate-limit/` |
| Relevance AI (partial) | `.env.example` — `RELEVANCE_API_KEY`; `lib/relevance/client.ts`, `relevance-service.ts`; `app/admin/relevance-ai/page.tsx` |
| Netlify | `netlify.toml`, `netlify/` directory |
| Zod | `package.json` — `"zod": "^3.25.27"` |
| react-hook-form | `package.json` — `"react-hook-form": "^7.56.3"` |
| Lucide React | `package.json` — `"lucide-react": "^0.469.0"` |

### Planned (in env/config but depth of integration unconfirmed)

| Technology | Notes |
|-----------|-------|
| Relevance AI | Env vars and lib files exist, but whether agents are live in production is unconfirmed. See [[09-open-questions]]. |
| WhatsApp Business API | Env vars and lib exist. Production connection status is unconfirmed. |
| Cal.com | Env vars and lib exist. Whether booking flows are live is unconfirmed. |
| PayPal | Primary payment provider. `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` drive the "configured" flag in admin Service Health. No payment capture/transaction reading exists yet, so revenue is always labelled "Estimated" (never "verified"/"Live"). |
| Stripe | Legacy backend (package + `lib/stripe/` + `/api/stripe/*` still present for backward compatibility). No longer the primary provider; admin UI now references PayPal. |

### Assumed (not yet verified in codebase)

| Technology | Status |
|-----------|--------|
| AWS S3 / file storage | No evidence found. Needs verification. |
| Plausible web analytics | No evidence found. Needs verification. |
| GitHub Actions CI/CD | Not confirmed from current codebase inspection. Needs verification. |
| n8n / Make / Zapier | No evidence found. May be used externally. Needs verification. |
| Botpress | No evidence found. Needs verification. |
| Prisma | Not used — Supabase client is used directly. |
| Auth0 | Not used — Supabase Auth is used. |

---

## Key notes for Claude Code

- **Auth is Supabase Auth** — do not reference Auth0 or JWT libraries independently
- **Database is Supabase** — do not write Prisma queries; use the Supabase client from `lib/supabase/`
- **Do not add new dependencies** without explicit approval
- **Do not upgrade existing packages** without explicit approval
- **Hosting is Netlify** — do not write Vercel-specific code. `vercel.json` exists but `netlify.toml` is primary. See [[09-open-questions]] for the hosting ambiguity.

---

## Related notes

- [[09-open-questions]] — Open questions about confirmed integrations
- [[04-agent-workflows]] — How Relevance AI agents are designed
- [[07-claude-code-rules]] — Code-level rules
