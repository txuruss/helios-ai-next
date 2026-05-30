# Open Questions — Helios AI Agency

See also: [[05-tech-stack]] | [[08-decision-log]] | [[10-feature-map]]

These are items that are unclear or unconfirmed. **Do not assume answers to these questions.** Mark related work as "Needs verification" until each question is resolved.

When a question is answered, move it to the **Resolved** section at the bottom and log the decision in [[08-decision-log]].

---

## Open questions

### Integrations

- **Is Relevance AI currently connected to the live app?**
  `lib/relevance/` and env vars exist. Is `RELEVANCE_API_KEY` populated in production? Are any agents actually running? Or is this infrastructure that has been set up but not yet activated?

- **Is WhatsApp Business API live in production?**
  Env vars and lib files exist. Has a WhatsApp Business Account been verified? Are messages being sent and received?

- **Is Cal.com connected and booking flows working end-to-end?**
  `CALCOM_API_KEY` is in `.env.example` and `lib/calcom/` exists. Has a real booking been made through this integration?

- **Are Stripe subscriptions active and billing clients?**
  Stripe is in the stack and confirmed. Are there active subscriptions? Is the webhook endpoint live and tested?

- **Is Resend sending real emails?**
  `RESEND_API_KEY` exists. Has a real transactional email been sent to a real recipient in production?

---

### Hosting

- **Is the live app hosted on Netlify or Vercel?**
  Both `netlify.toml` and `vercel.json` exist. Which platform is the production deployment on? Does the production URL resolve to Netlify or Vercel?

---

### Authentication

- **What is the current auth implementation in full detail?**
  Supabase Auth is confirmed. Is email/password auth active? Is magic link active? Is OAuth (Google, etc.) configured? Are there any custom session rules in `middleware.ts`?

---

### Database

- **Which database migrations have been applied to the production database?**
  There are 20+ migration SQL files in `supabase/`. Which ones are applied? Is the production schema up to date with all migration files?

- **Is there a staging database separate from production?**
  Needs verification.

---

### App routes and features

- **Which dashboard routes are fully implemented vs stub/placeholder pages?**
  Routes exist for `/dashboard/`, `/admin/`, `/team/`, `/client/`. Which of these are fully functional with real data? Which are placeholder `page.tsx` files with no real content?

- **Which phases (1–28+) of the build are actually implemented and live?**
  The README mentions many phases. The `.env.example` references phases up to 23+. Which phases are fully complete, which are partial, and which are planned?

- **Is the demo flow at `/demo/` functional with real AI responses?**
  `app/demo/` and `app/demo/widget/` exist. Is the demo sending real API requests to Anthropic Claude?

- **Is the team login at `/team/login/` functional and separate from admin/client auth?**
  `app/team/login/` exists. How does team auth work — same Supabase users with a role flag, or a completely separate auth path?

---

### Pricing and offers

- **What are the actual prices for each package?**
  This brain defines the package structure but not the numbers. Has pricing been finalized?

- **Which pricing tiers are currently published publicly on the pricing page?**
  `app/(public)/pricing/page.tsx` exists. What is on that page right now?

- **Is there a setup fee in addition to monthly retainer?**
  Not confirmed. Needs a decision.

---

### Features

- **Which integrations are confirmed production-ready (fully tested end-to-end)?**
  Partial list from stack: Supabase, Sentry, PostHog, Stripe, Resend, Cal.com, WhatsApp, Relevance AI. Which are fully live?

- **What is the current state of the Ops Center feature set?**
  Many `add-ops-*.sql` migration files exist. Is the Ops Center live in the app?

- **Is file/blob storage (e.g. AWS S3) used anywhere in the app?**
  No evidence found in codebase inspection. Needs verification.

- **Is GitHub Actions CI/CD set up for this repo?**
  Not confirmed. Does a `.github/workflows/` directory exist?

---

## Resolved questions

*(Move items here once answered, with the answer and the date resolved.)*

| Date Resolved | Question | Answer | Decision logged |
|--------------|---------|--------|----------------|
| — | — | — | — |
