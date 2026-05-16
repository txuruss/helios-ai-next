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

## Phase 9 — WhatsApp Business API Setup

### Prerequisites

- A [Meta Developer account](https://developers.facebook.com)
- A WhatsApp Business Account
- A verified phone number in WhatsApp Business Manager
- Pro or Scale Helios AI plan

### Step 1 — Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**.
2. Choose **Business** as the app type.
3. Name it (e.g. "Helios AI WhatsApp").

### Step 2 — Add the WhatsApp Product

1. In your app dashboard, click **Add Product**.
2. Select **WhatsApp** → **Set Up**.

### Step 3 — Get Your IDs

In **WhatsApp** → **API Setup**:
- Copy **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
- Copy **WhatsApp Business Account ID** → `WHATSAPP_BUSINESS_ACCOUNT_ID`

### Step 4 — Create a System User Access Token

1. Go to **Business Settings** → **System Users** → **Add**.
2. Assign the system user the **Admin** role.
3. Click **Generate New Token** → select your app → grant `whatsapp_business_messaging` permission.
4. Copy the token → `META_ACCESS_TOKEN`

> Use a **System User token** (not a temporary test token) — it never expires.

### Step 5 — Set Environment Variables

In your `.env.local` (and production env):

```env
META_ACCESS_TOKEN=your_permanent_system_user_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
WHATSAPP_VERIFY_TOKEN=any_random_secret_string_you_choose
META_APP_SECRET=your_app_secret   # optional — enables signature verification
```

Get `META_APP_SECRET` from **App Settings** → **Basic** → **App Secret**.

### Step 6 — Configure the Webhook

In your Meta App → **WhatsApp** → **Configuration** → **Webhook**:

| Field | Value |
|---|---|
| **Callback URL** | `https://your-domain.com/api/webhooks/whatsapp` |
| **Verify Token** | The value you set in `WHATSAPP_VERIFY_TOKEN` |

Click **Verify and Save**. The webhook will call `GET /api/webhooks/whatsapp` — the route returns the challenge if the token matches.

### Step 7 — Subscribe to Webhook Fields

In **Webhook Fields**, click **Manage** and subscribe to:
- `messages` ✓

### Step 8 — Test Locally with ngrok

```bash
ngrok http 3001
```

Use the ngrok HTTPS URL as your Callback URL in the Meta App. The webhook route handles both verification (GET) and incoming messages (POST).

### Step 9 — Enable WhatsApp in the Dashboard

1. Navigate to `/dashboard/whatsapp`.
2. Confirm all env status indicators show green.
3. Toggle **Enable WhatsApp Channel** to ON.
4. Click **Save Settings**.

WhatsApp is now live. Incoming messages trigger the AI assistant and appear in the Message Log.

### Webhook Events Reference

| Event | What it does |
|---|---|
| Incoming text message | Creates/updates chat session → AI reply → saves to whatsapp_messages |
| Delivery/read receipt | Acknowledged silently (no DB write) |
| Media, reaction, etc. | Acknowledged silently — text-only in Phase 9 |

### Plan Requirements

| Plan | Widget | WhatsApp |
|---|---|---|
| Starter | ✓ | — |
| Pro | ✓ | ✓ |
| Scale | ✓ | ✓ |

### Privacy Notes

- Phone numbers are masked in all logs (`••• 1234`).
- Only the first 200 characters of each message are stored in `content_summary`.
- Full message content is never logged to Sentry or PostHog.
- `META_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, and `META_APP_SECRET` are server-only — never prefix with `NEXT_PUBLIC_`.
- Webhook signature verification (`x-hub-signature-256`) is enforced in production when `META_APP_SECRET` is set.

---

## Phase 10 — WhatsApp Inbox, Handoff & Media

### How the Inbox Works

Navigate to `/dashboard/inbox` (Pro+ plan). The inbox shows all WhatsApp conversations filtered by status:

| Status | Meaning |
|---|---|
| `ai` | AI is handling replies automatically |
| `human_requested` | Customer asked for a human — AI stopped |
| `human` | Agent has taken over |
| `resolved` | Conversation closed |
| `archived` | Hidden from default views |

Select a conversation to see the full message thread. Use the right panel to:
- Change status (Mark Human, Return to AI, Resolve, Archive)
- Assign to yourself
- Add internal notes (visible to team only, never sent to customer)

### Human Handoff Behavior

When a customer sends a message containing phrases like **"human", "agent", "representative", "talk to someone", "real person"**:

1. The webhook detects the handoff request
2. Sets `handoff_status = 'human_requested'` on the session
3. Sends a **one-time** WhatsApp reply: *"I'll notify the team so someone can help you directly."*
4. AI stops auto-replying for that conversation
5. The inbox shows the conversation under "Needs Agent"

When an agent is ready, they click **Assign to me** → status becomes `human` → they reply manually.

### How to Send Manual Replies

1. Open a conversation in `/dashboard/inbox`
2. Type a message in the Reply composer at the bottom
3. Press Enter or click ↑ — the message is sent via WhatsApp and logged

Requires Pro plan. API: `POST /api/whatsapp/send` (auth required, business_id derived from session).

### How to Handle Media Messages

When a customer sends an **image, document, or video**:
- The media ID and MIME type are saved to `whatsapp_messages`
- A safe reply is sent: *"I received your attachment. A team member can review it if needed."*
- For images and documents, `handoff_status` is set to `human_requested`
- Full media files are not downloaded or stored — only the Meta media ID

### How Template Sending Works

Templates must be **pre-approved** in Meta Business Manager before use.

**Scale plan only.** From the conversation composer:
1. Click **Template** tab
2. Enter template name (lowercase, underscores, e.g. `appointment_reminder`)
3. Enter language code (e.g. `en_US`)
4. Click Send

API: `POST /api/whatsapp/send-template` (Scale plan enforced server-side).

### Meta Template Requirements

- Submitted and approved at [business.facebook.com](https://business.facebook.com) → Message Templates
- Template name must match exactly (case-sensitive)
- Language code must match the approved variant (e.g. `en_US`, `es`, `en`)
- Templates are required when the 24-hour customer messaging window has expired

### Privacy Notes (Phase 10)

- Phone numbers masked in all UI displays (`••• 1234`)
- Internal notes never sent to the customer
- Media files not stored — only `media_id` and `media_mime_type` saved
- Template names and language codes are logged but contain no PII
- PostHog events contain only safe metadata (business_id prefix, plan, message_type)

### Plan Gating (Phase 10)

| Feature | Starter | Pro | Scale |
|---|---|---|---|
| WhatsApp channel | — | ✓ | ✓ |
| Inbox & handoff | — | ✓ | ✓ |
| Manual replies | — | ✓ | ✓ |
| Template messages | — | — | ✓ |

Server-side enforcement: all plan checks happen in API routes and server actions.

---

## Phase 11 — Realtime Inbox, Unread Counts & Bulk Actions

### How Realtime Inbox Works

The inbox uses Supabase Realtime (`postgres_changes`) to push live updates:
- `chat_sessions` changes are broadcast per `business_id` → conversation list updates in place without refresh
- `whatsapp_messages` inserts are broadcast per `business_id` → new messages append to the open thread in real time
- A green dot + "Live" indicator appears in the inbox header when the subscription is active
- Subscriptions are cleaned up on component unmount

**Supabase Realtime requirements**: Run `db/add-inbox-realtime-fields.sql` to add the tables to the `supabase_realtime` publication. Both `chat_sessions` and `whatsapp_messages` must be enabled. Check Supabase Dashboard → Database → Replication if the migration doesn't apply.

### How Unread Counts Work

- `unread_count` on `chat_sessions` is incremented atomically by the webhook handler (`increment_chat_session_unread` SQL function) each time an inbound WhatsApp message arrives
- The sidebar badge (`InboxUnreadBadge`) fetches the total unread count on mount, then re-fetches every 30 seconds
- Opening a conversation calls `markConversationRead()` which resets `unread_count = 0` and sets `last_read_at`
- Sending a manual reply also resets `unread_count = 0`
- Badge shows 99+ for counts over 99

### How Conversation Sorting Works

Conversations are sorted client-side:
1. Priority: `urgent > high > normal > low`
2. Handoff urgency: `human_requested` appears first within the same priority
3. Recency: `last_message_at DESC` as tiebreaker

Priority badges (red stripe = urgent, orange = high) appear on conversation rows.

### How Bulk Actions Work

1. Check the checkbox on one or more conversations
2. The bulk action bar appears at the bottom of the conversation list
3. Available actions: **Mark Read**, **Resolve**, **Archive**, **Assign to me**
4. Maximum 50 conversations per bulk operation (server-enforced)
5. Session IDs are validated as UUIDs server-side; `business_id` is derived from the authenticated user

### How Assignment Works

- Click **Assign to me** in the conversation controls sidebar
- An assignment email is sent to the assignee (if email is configured) via Resend
- A `conversation_assignments` row is created; any previous active assignment is released
- Session `handoff_status` is set to `human` on assignment
- Click **Unassign** to release the assignment — `assigned_to` is cleared

### WhatsApp 24-Hour Window Behavior

WhatsApp's customer service messaging window closes 24 hours after the last message from the customer:

| State | Time since last customer message | UI behavior |
|---|---|---|
| Open | < 23 hours | Normal reply box |
| Warning | 23–24 hours | Orange warning + time remaining |
| Closed | > 24 hours | Reply box disabled, template tab highlighted |

- Normal reply is blocked server-side if the window is closed (`/api/whatsapp/send` returns an appropriate error)
- Approved template messages remain available for Scale plan users to re-open the conversation

### How Assignment Email Notifications Work

When a conversation is assigned:
- A Resend email is sent to the assignee's profile email (fire-and-forget — never blocks assignment)
- The email includes: business name, masked phone number, priority, and a direct link to the conversation
- A `notifications` row is created for in-app tracking
- Full message content and customer phone are never included in the email

### Privacy Notes (Phase 11)

- Realtime payloads contain `content_summary` (max 200 chars) and session metadata — no full messages
- Unread count badge contains only a number — no phone numbers or content
- Bulk action audit logs contain action type and count — no phone numbers or message content
- Assignment emails contain masked phone number only (`••• 1234`)

---

## Phase 12 — Mission Control + Ops Center

### Mission Control (`/dashboard`)

The dashboard homepage is now a full Mission Control page showing:
- **System status pill** — green when all healthy, red when critical alerts exist
- **KPI cards** — New Leads, Bookings, AI Conversations, WhatsApp Messages, Open Alerts, Pending Approvals, Agent Runs, Plan
- **Attention Required** — critical alerts and urgent tasks at a glance
- **Plan & Usage** — progress bars for AI conversations, leads, bookings this month
- **Live Activity** — latest ops events auto-logged from all integrations
- **Agent Runs** — recent agent runs with status
- **System Health** — status of all 8 integrations (Widget, Anthropic, Cal.com, WhatsApp, Stripe, Relevance AI, PostHog, Sentry)
- **Ops Center button** — quick link to the full Ops Center

The existing business setup screen is fully preserved for users without a business profile.

### Ops Center (`/dashboard/ops`)

A dedicated operations management page with 7 tabs:

| Tab | Content |
|---|---|
| Overview | Metric cards + recent events + top open items |
| Activity | Full event feed with severity/status filters + resolve button |
| Alerts | Alert panel with acknowledge/resolve actions |
| Tasks | Task board with start/complete actions |
| Approvals | Approval queue with approve/reject decisions |
| System Health | Integration health grid |
| Client Systems | Widget, WhatsApp, Cal.com status table |

### Ops Events

Events are automatically logged (fire-and-forget) from:
- **Chat**: lead created, AI error, plan limit reached
- **WhatsApp**: manual reply sent/failed
- **Cal.com**: booking created/failed
- **Stripe**: payment failed
- **Relevance AI**: agent run started/failed

Events contain: source, event_type, severity (info/warning/error/critical), title, and optional description. No phone numbers, message content, or API keys are stored.

### Alerts

Ops alerts can be: active → acknowledged → resolved. Resolved at timestamp recorded. Critical alerts appear in the Mission Control attention panel and system status pill.

### Tasks

Ops tasks have priority (low/normal/high/urgent) and status (pending → in_progress → completed). Tasks appear in the Mission Control attention panel when urgent or high priority.

### Approvals

Approval items can be approved or rejected by authenticated dashboard users. Reviewed_by and reviewed_at are recorded. Content field stores a safe truncated summary (max 10,000 chars).

### System Health

Health is determined server-side by checking:
- Env var presence (ANTHROPIC_API_KEY, CALCOM_API_KEY, META_ACCESS_TOKEN, etc.)
- DB connection rows (calcom_connections, whatsapp_connections, subscriptions)

Status values: `healthy`, `degraded`, `unconfigured`, `unknown`. No API keys are returned to the browser — only the status label and a safe detail string.

### Client Systems

Shows Widget, WhatsApp, and Cal.com activation status with last-updated timestamps. Status is derived from `widget_settings.is_enabled`, `whatsapp_connections.is_enabled`, and `calcom_connections.is_connected`.

### Realtime Behavior

Ops Center subscribes to Supabase Realtime on `ops_events`, `ops_alerts`, and `ops_tasks` tables. The refresh button triggers a full reload of all tabs. A "Live" indicator is planned for Phase 13 (not yet wired in the Ops Center tabs).

### Privacy Protections (Phase 12)

- No phone numbers stored in ops events
- No message content stored in ops events
- No API keys or tokens in ops events
- System health responses contain only status labels, not raw env values
- Approval content is truncated to 500 chars in the UI

---

## Phase 13 — Ops Center: Realtime, Automation, Export & Bulk Actions

### Ops Center Realtime Behavior

The Ops Center now subscribes to Supabase Realtime on all 4 ops tables filtered by `business_id`:
- `ops_events` → prepends new events to the Activity feed, updates metrics counter
- `ops_alerts` → prepends new alerts, updates Active Alerts count, syncs updates in place
- `ops_tasks` → prepends new tasks, updates Active Tasks count, syncs updates in place
- `approval_items` → prepends new approvals, updates Pending count, syncs updates in place

A green "Live" indicator with pulse animation appears in the Ops Center header. "Updated [time]" appears after each real-time event. Subscriptions are cleaned up on component unmount.

### Automation Rules

The **Automation Rules** tab (8th tab) shows rules that automatically process ops events to create alerts, tasks, and approval items.

**Default rules** (seeded via "Seed Default Rules" button):
| Trigger | Action | Priority |
|---|---|---|
| Any severity = `critical` | Create alert | Urgent |
| Any event_type contains `failed` | Create alert | High |
| `stripe` / `payment_failed` | Create urgent alert | Urgent |
| `calcom` / `booking_failed` | Create task | High |
| `whatsapp` / `manual_reply_failed` | Create task | High |
| `chat` / `plan_limit_reached` | Create alert | Normal |
| `whatsapp` / `handoff_requested` | Create task | High |
| `relevance` / `agent_run_failed` | Create alert | Normal |

**"Run Automation Now"** processes all unprocessed open events against all enabled rules (max 50 per run). Events are marked `processed_at` after processing.

Rule toggle enables/disables individual rules without deleting them.

### Auto-Created Alerts

Alerts are automatically created by the automation engine when:
- A critical-severity ops event is logged
- Any `_failed` event is logged (chat AI error, booking failure, manual reply failure, agent run failure)
- Payment failure is detected from Stripe

### Auto-Created Tasks

Tasks are automatically created when:
- A Cal.com booking fails
- A WhatsApp manual reply fails to send
- A WhatsApp customer requests a human agent (handoff)

### Approval Generation

Approval items are automatically created when:
- A Relevance AI agent run completes with output (via `POST /api/relevance/webhook`)
- The approval_type is `agent_output`, linked to the `agent_runs` row
- Output content is stored in `agent_outputs` with status `pending_review`

### CSV/JSON Export

Export buttons appear in the Activity, Alerts, Tasks, and Approvals tabs.

**Safe fields only** — no raw metadata, no phone numbers, no API keys, no full message content.

| Export type | Fields |
|---|---|
| ops_events | id, source, event_type, severity, title, description, status, timestamps |
| ops_alerts | id, alert_type, severity, title, message, status, timestamps |
| ops_tasks | id, title, description, task_type, priority, status, timestamps |
| approvals | id, approval_type, title, description, status, requested_by, priority, timestamps |

Max 2000 rows per export. Each export is logged to `ops_exports`. Download triggered in-browser via `blob URL`.

### Bulk Actions

Each tab now has checkboxes per row and a bulk action bar:

| Tab | Actions |
|---|---|
| Activity | Resolve, Ignore |
| Alerts | Acknowledge, Resolve |
| Tasks | Start, Complete, Dismiss |
| Approvals | Approve, Reject, Archive |

Max 50 items per bulk operation (server-enforced). IDs validated as UUIDs server-side.

### Assignment Behavior

Each row in Activity, Alerts, Tasks, and Approvals shows an "Assign" dropdown when `business_members` has team members. Loaded once on mount via `getBusinessMembersForAssignment()`. Assignment stored in `assigned_to` field per row. Team members identified by profile email/name (masked in logs).

### Privacy and Security Notes (Phase 13)

- Export files contain no raw metadata fields, phone numbers, or API keys
- Automation rules contain no customer data — only event type patterns and template strings
- Approval content truncated to 500 chars in the UI, 10,000 chars in DB (safe summary only)
- `processed_at` marks events after automation — does not store the output
- `processing_error` stores only the error message (max 500 chars) — no raw payloads
- Realtime payloads use the existing RLS-filtered Supabase subscription

---

## Phase 14 — SLA Timers, Notification Routing & Audit Trail

### SLA Policy Behavior

Each ops item (alert, task, approval) gets a `sla_due_at` timestamp set automatically when created via the automation engine.

**Default SLA targets** (seeded via SLA & Routing tab):
| Target | Response time |
|---|---|
| Critical alert | 15 minutes |
| Error alert | 60 minutes |
| Warning alert | 4 hours |
| Urgent task | 30 minutes |
| High-priority task | 2 hours |
| Normal task | 24 hours |
| Approval item | 24 hours |
| WhatsApp handoff | 10 minutes |
| Booking failed | 30 minutes |
| Payment failed | 60 minutes |

**SLA status** (computed client-side from `sla_due_at`):
- `on_track` — more than 1 hour remaining
- `warning` — under 1 hour
- `due_soon` — under 15 minutes (orange badge)
- `breached` — past `sla_due_at` (red badge)
- `escalated` — `escalation_level > 0` (purple badge)
- `resolved` — item is completed/resolved

**Run SLA Check Now** (Ops Center → SLA & Routing tab): Finds all unescalated items past `sla_due_at`, increments `escalation_level`, sets `escalated_at`. Also available via `POST /api/ops/sla/run`.

### Notification Routing Behavior

When ops events are created or items assigned, the notification engine matches against `ops_notification_rules`:

**Default rules** (seeded via SLA & Routing tab):
| Trigger | Channel | Recipient |
|---|---|---|
| Critical alert created | Email | Owner |
| Payment failed | Email | Owner |
| Booking failed | Email | Owner |
| Handoff requested | Email | Owner |
| Item assigned | Email | Assigned user |
| SLA breached | Email | Assigned user |
| Escalation created | Email | Owner |
| Approval created | Dashboard | Owner |

Notification emails use the existing Resend setup. Safe content only — no customer messages, no raw phone numbers. Each email includes the item title, severity, source, and a direct link to the relevant Ops Center tab.

### Escalation Behavior

After `processSlaBreaches` runs (manually or via the SLA run button):
1. Items with `sla_due_at < now` and `escalated_at IS NULL` have `escalation_level` incremented by 1
2. `escalated_at` is set to the current time
3. Purple "ESC 1" badge appears on the item in the UI

### Assignment Notification Behavior

When `assignOpsItem` is called (from the Assign dropdown in any tab):
1. `assigned_to` and `assigned_user_name` are updated on the item
2. Audit trail entry is created (`assigned` action)
3. Fire-and-forget email sent to the assigned user's profile email
4. Email includes: item title, type, dashboard link — no message content or phone numbers

### Audit Trail Behavior

`ops_audit_trail` records:
- Status changes: `status_changed.{new_status}` with before/after state
- Assignment changes: `assigned` or `unassigned` with before/after user IDs
- Bulk actions: `bulk.{action}` with item count

Audit records are written fire-and-forget — never block the primary action.

### Mission Control SLA Widgets

Three new KPI cards on the Mission Control dashboard:
- **SLA Breached** — total alerts + tasks past their SLA due time
- **Due Soon** — items due within 1 hour
- **Escalated** — items that have been escalated (escalation_level > 0)

### SLA & Routing Tab (Ops Center 9th tab)

Shows:
- SLA Summary Cards (Breached / Due Soon / Escalated / On Track)
- SLA Policies table with per-policy enable/disable toggle
- Notification Rules table with per-rule enable/disable toggle
- Recent Audit Trail (last 30 entries)
- Buttons: Seed Default SLA Policies, Seed Default Notifications, Run SLA Check Now

### Privacy and Security Notes (Phase 14)

- Notification emails contain only: item title, severity, source, and a dashboard URL — no customer messages, phone numbers, or full names
- Audit trail records only: action type, table name, item ID, before/after status or assignment — no message content or API keys
- SLA processing errors are stored in `processing_error` (max 500 chars) — no raw payloads
- `sla_due_at` is a computed timestamp — not a customer-facing field

---

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — only use server-side in server actions or API routes.
- Never prefix service role key with `NEXT_PUBLIC_`.
- All dashboard routes are protected by middleware + layout-level auth checks.
- RLS policies ensure users can only access their own business data.
- No secrets are committed — `.env.local` is in `.gitignore`.
- All Meta API calls happen server-side only. No WhatsApp credentials reach the browser.
