# Helios AI — Supabase Schema Management

## The problem this solves

`supabase/migrations/` only contains the **agency layer** (migrations from `20260518120000` onward: `team_members`, `audit_submissions`, `admin_*`, `research_*`). The **base product schema** — `profiles`, `businesses`, `business_members`, `subscriptions`, `leads`, `chat_sessions`, `chat_messages`, `whatsapp_connections`, `whatsapp_messages`, `widget_settings`, `usage_events`, `audit_logs`, `ops_alerts`, `ops_tasks`, `helios_agents`, `agent_runs`, and more — was created directly in Supabase and is **not represented in the repo**.

Consequences: the database cannot be recreated from the repo, base-table RLS cannot be reviewed in code, and a fresh/staging environment will not match production.

**This must be fixed by dumping the live schema. It cannot be done from this repo or by the assistant** — generating a baseline requires direct database access (the Supabase CLI or a Postgres connection), which is not available in the build environment. The steps below are for you to run locally. **Do not hand-write or invent a baseline migration** — only a real dump is trustworthy.

---

## Step 1 — Install + link the Supabase CLI (one time)

```bash
# Install (macOS/Linux via npm, or see supabase.com/docs/guides/cli)
npm install -g supabase

# Log in (opens a browser for an access token)
supabase login

# Link this repo to the live project (find the ref in the Supabase dashboard URL)
cd helios-ai-next
supabase link --project-ref <your-project-ref>
```

`supabase link` creates `supabase/config.toml` — commit it.

## Step 2 — Capture the live schema as a baseline migration

Pick **one** of these:

```bash
# A) Dump the full public schema (DDL only — tables, columns, constraints, RLS,
#    policies, functions, triggers). Recommended for the baseline.
supabase db dump --schema public -f supabase/migrations/00000000000000_baseline.sql

# B) Pull — diffs the live DB against local migrations and writes a new
#    migration for anything not already represented.
supabase db pull
```

Notes:
- Name the baseline with an all-zero timestamp (`00000000000000_baseline.sql`) so it sorts **before** the existing `2026…` agency migrations and never re-runs over them.
- The dump will include the agency tables too (they exist live). That's fine — the existing `2026…` migrations are `IF NOT EXISTS`/idempotent, so they no-op against a DB created from the baseline.
- **Review the diff before committing.** Strip anything environment-specific (roles, grants you don't manage). Do not commit data — schema only (`--schema public`, no `--data-only`).

## Step 3 — Verify the baseline reproduces the DB

```bash
# Start a local stack and apply migrations from scratch
supabase start
supabase db reset   # applies baseline + all agency migrations to a clean DB
```

If `db reset` succeeds and the app boots against the local stack, the schema is reproducible. Commit `supabase/config.toml` + the baseline migration.

## Step 4 — Going forward

- Every schema change ships as a new timestamped migration in `supabase/migrations/` (the agency layer already follows this).
- Apply with `supabase db push` (or paste into the SQL editor, as today) — but the migration file is the source of truth.
- Never edit an already-applied migration; add a new additive one.

---

## RLS verification checklist

Until Step 2 is done, RLS on the base tables can only be confirmed **in Supabase directly**. Run these in the **SQL Editor** and confirm the results against the expected model below. (The assistant cannot read RLS state from the repo for base tables — it is not in the code.)

### Query 1 — Is RLS enabled + forced on every audited table?

```sql
select c.relname               as table_name,
       c.relrowsecurity        as rls_enabled,
       c.relforcerowsecurity   as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles','businesses','business_members','leads','subscriptions',
    'agent_runs','usage_events','audit_logs',
    'research_leads','research_runs','admin_outreach_leads','admin_clients','team_members'
  )
order by c.relname;
```

Every row should show `rls_enabled = true`. Any `false` is a finding — that table is readable by anyone with the anon key unless protected elsewhere.

### Query 2 — What policies exist on each table?

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','businesses','business_members','leads','subscriptions',
    'agent_runs','usage_events','audit_logs',
    'research_leads','research_runs','admin_outreach_leads','admin_clients','team_members'
  )
order by tablename, policyname;
```

### Expected access model (verify each)

| Table | Expected RLS | Notes |
|---|---|---|
| `profiles` | `id = auth.uid()` self-access | A user reads/updates only their own profile. |
| `businesses` | member-scoped via `business_members` | Owner/staff of the business only; founder via service role. |
| `business_members` | `user_id = auth.uid()` (own memberships) | Never let a user read other businesses' membership rows. |
| `leads` (product) | scoped by `business_id` through the caller's membership | These are a **client's** captured customers, not Helios agency leads. |
| `subscriptions` | scoped by `business_id` (read), writes by service role only | Status is set only by the Stripe webhook. |
| `agent_runs` | scoped by `business_id` | A client sees only their own agent runs. |
| `usage_events` | service-role write; read scoped by `business_id` | Billing/usage data. |
| `audit_logs` | service-role write; founder/owner read only | Never client-writable. |
| `research_leads` | **founder-only** RLS (`is_founder_admin()`) | Agents read via service role + `leadScopeFor()` in app code (`lib/data/scoped-leads.ts`). |
| `research_runs` | **founder-only** RLS | Same — per-run ownership enforced in app code. |
| `admin_outreach_leads` | **founder-only** RLS | Same — per-agent ownership enforced in app code. |
| `admin_clients` | **founder-only** RLS | Founder agency CRM. |
| `team_members` | founder reads all; member reads own active row | `FORCE ROW LEVEL SECURITY`; see migration `20260518120000`. |

> The four `research_*`/`admin_*` lead tables are **intentionally founder-only in RLS** — per-agent isolation for outreach agents is enforced in `lib/data/scoped-leads.ts`, not the database. See `docs/security-guardrails.md`. Hardening these with row-ownership RLS (so the DB also enforces it) is a future task, non-trivial because reads currently go through the service-role client.

### Query 3 — Spot-check anon exposure (optional, thorough)

In the SQL editor, run a read **as the anon role** to confirm base tables are not world-readable:

```sql
set role anon;
select count(*) from public.leads;          -- expect: error or 0 rows (RLS)
select count(*) from public.subscriptions;  -- expect: error or 0 rows (RLS)
reset role;
```

Record the results of all three queries somewhere durable (e.g. a dated note) so the RLS posture is known before Mission Control expands the surface.
