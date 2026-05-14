# Helios AI — Next.js App Router Foundation

> **Phase 1** of the Helios AI production SaaS platform.
> Premium dark AI operations dashboard for local service businesses.

---

## Tech Stack

| Layer       | Technology                               |
|-------------|------------------------------------------|
| Framework   | Next.js 15 (App Router)                  |
| Language    | TypeScript                               |
| Styling     | Tailwind CSS v3 + custom Helios tokens   |
| Components  | shadcn/ui-compatible primitives          |
| Animation   | Framer Motion 11                         |
| Auth        | Supabase Auth (email + password)         |
| Database    | Supabase Postgres + Row Level Security   |
| Deployment  | Vercel                                   |

---

## Project Structure

```
helios-ai-next/
├── app/
│   ├── (public)/page.tsx          ← Landing page (/)
│   ├── (auth)/
│   │   ├── layout.tsx             ← Centered auth layout
│   │   ├── login/page.tsx         ← /login
│   │   └── signup/page.tsx        ← /signup
│   ├── (dashboard)/
│   │   ├── layout.tsx             ← Protected server layout
│   │   └── dashboard/
│   │       ├── page.tsx           ← /dashboard (overview)
│   │       ├── agents/page.tsx
│   │       ├── business/page.tsx
│   │       ├── services/page.tsx
│   │       ├── leads/page.tsx
│   │       ├── bookings/page.tsx
│   │       ├── calcom/page.tsx
│   │       ├── widget/page.tsx
│   │       └── settings/page.tsx
│   ├── layout.tsx                 ← Root layout (fonts, metadata)
│   └── globals.css                ← Tailwind + Helios design tokens
├── components/
│   ├── ui/cn.ts                   ← clsx + tailwind-merge helper
│   ├── landing/                   ← Public landing page sections
│   ├── auth/                      ← LoginForm, SignupForm
│   └── dashboard/                 ← Sidebar, Topbar, DashboardShell, StatCard…
├── lib/
│   ├── supabase/client.ts         ← Browser Supabase client
│   ├── supabase/server.ts         ← Server Supabase client + service role
│   ├── auth/actions.ts            ← login(), signup(), logout() server actions
│   ├── validation/schemas.ts      ← Zod schemas
│   └── constants/index.ts         ← Nav, agents, pricing, business types
├── types/index.ts                 ← TypeScript types mirroring DB schema
├── middleware.ts                  ← Route protection (redirects /dashboard → /login)
├── db/
│   ├── schema.sql                 ← All 17 tables + triggers + indexes
│   ├── policies.sql               ← RLS policies for all tables
│   └── seed.sql                   ← Demo data (dev only)
└── .env.example
```

---

## How to Run Locally

### 1. Clone and install

```bash
cd helios-ai-next
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your values (see "How to connect Supabase" below):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Apply database schema

See "How to apply schema.sql" below.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to Connect Supabase

### Create a project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users (e.g. US East for Caribbean).
3. Set a strong database password and save it securely.

### Get your API keys

1. In your Supabase dashboard → **Project Settings** → **API**.
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(never expose this in the browser)*

---

## How to Apply schema.sql

**Option A — Supabase SQL Editor (recommended):**

1. Open your Supabase project dashboard.
2. Navigate to **SQL Editor** → **New Query**.
3. Paste the contents of `db/schema.sql`.
4. Click **Run**.

**Option B — psql CLI:**

```bash
psql $DATABASE_URL -f db/schema.sql
```

Your database connection string is in Supabase → **Project Settings** → **Database** → **URI**.

---

## How to Apply policies.sql

Run `db/policies.sql` the same way, **after** `schema.sql`:

**Supabase SQL Editor:**

1. Open a new query.
2. Paste `db/policies.sql`.
3. Click **Run**.

This enables RLS on all 17 tables and creates all access policies.

---

## How to Run seed.sql (Development Only)

1. Sign up at [http://localhost:3000/signup](http://localhost:3000/signup).
2. Copy your user UUID from Supabase Dashboard → **Authentication** → **Users**.
3. Edit `db/seed.sql`, replace `<YOUR_USER_UUID>` with your UUID.
4. Run it in the Supabase SQL Editor.

This creates a demo business (Island Glow Beauty Studio) with services, leads, and bookings.

---

## How to Test Login

1. Navigate to [http://localhost:3000/signup](http://localhost:3000/signup).
2. Create an account with any email and password (min. 6 chars).
3. If Supabase email confirmation is **enabled** (default): check your inbox for a confirmation link, then sign in.
4. If email confirmation is **disabled** (for local dev): you'll be redirected to `/dashboard` automatically.

**To disable email confirmation for local development:**
Supabase Dashboard → **Authentication** → **Email** → uncheck "Enable email confirmations".

---

## How to Test Dashboard Protection

**Without session:**
```
http://localhost:3000/dashboard
→ Redirected to: http://localhost:3000/login?redirectTo=/dashboard
```

**After login:**
```
http://localhost:3000/dashboard
→ Loads Mission Control dashboard
```

**After logout:**
- Click "Log Out" in the sidebar or topbar dropdown.
- You're redirected to `/login`.
- Navigating back to `/dashboard` redirects to `/login` again.

The protection runs in two places:
1. `middleware.ts` — fast edge-level redirect before the page renders
2. `app/(dashboard)/layout.tsx` — server-side double-check before rendering children

---

## Deploy to Vercel

```bash
vercel
```

Or connect via the Vercel dashboard and import from GitHub.

**Required environment variables in Vercel:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | Your production URL (e.g. `https://heliosai.com`) |

**Supabase Auth configuration for production:**
Supabase Dashboard → **Authentication** → **URL Configuration**:
- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/auth/callback`

---

## Phase 2 — What Comes Next

The following integrations are scaffolded but **not yet wired**. Each section has comments showing exactly where to connect.

| Feature | File to update | Env var needed |
|---|---|---|
| **Anthropic AI agents** | `lib/agents/` (create), `app/(dashboard)/dashboard/agents/page.tsx` | `ANTHROPIC_API_KEY` |
| **AI widget (chat)** | `app/api/widget/` (create), `public/widget.js` (create) | — |
| **Cal.com booking** | `app/api/calcom/`, `app/(dashboard)/dashboard/calcom/page.tsx` | `CALCOM_API_KEY` |
| **Stripe billing** | `app/api/stripe/`, `app/(dashboard)/dashboard/settings/page.tsx` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Resend email** | `lib/email/` (create), notification system | `RESEND_API_KEY` |
| **PostHog analytics** | `components/providers/PostHogProvider.tsx` (create) | `NEXT_PUBLIC_POSTHOG_KEY` |
| **Sentry errors** | `sentry.*.config.ts` (create) | `SENTRY_DSN` |
| **Upstash rate limiting** | `middleware.ts` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

### Authentication upgrade

The current auth uses Supabase email/password. To add more providers:
```typescript
// lib/auth/actions.ts
await supabase.auth.signInWithOAuth({ provider: 'google' })  // add GOOGLE_CLIENT_ID/SECRET
```

### Supabase typed client

After schema is finalised, generate precise TypeScript types:
```bash
npx supabase gen types typescript --project-id your-project-id > types/database.ts
```

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — only use server-side in server actions or API routes.
- Never prefix service role key with `NEXT_PUBLIC_`.
- All dashboard routes are protected by middleware + layout-level auth checks.
- RLS policies ensure users can only access their own business data.
- No secrets are committed — `.env.local` is in `.gitignore`.
