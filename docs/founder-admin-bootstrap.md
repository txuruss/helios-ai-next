# Founder Admin Bootstrap

> Production-safe steps to grant the founder access to `/admin/mission-control` for the first time. Run these once per environment after applying the `team_members` migration.

## What this does

- Confirms your Supabase auth user ID.
- Inserts a single row into `public.team_members` with `role = 'founder_admin'`.
- Verifies the row.
- Confirms `/admin/mission-control` opens.

Until that row exists in a given environment, `/admin/*` is unreachable in production (middleware redirects to `/team/login`; `requireTeam()` then redirects again because no team membership exists). The dev-only mock fallback (`HELIOS_ENABLE_MOCK_AUTH=true`) bypasses this for local development only — it is **explicitly disabled in production** by `mockAuthEnabled()` in `lib/auth/mock-session.ts`.

## Prerequisites

1. The migration `supabase/migrations/20260518120000_create_team_members.sql` has been applied to the target Supabase project (run via the Supabase CLI, the SQL Editor, or your migration pipeline).
2. You have signed up at `/signup` with your founder email in the target environment. This creates the row in `auth.users` that the migration depends on.
3. You have access to the Supabase SQL Editor for the target project (or `psql` with the service role connection string).

## Step 1 — Find your Supabase auth user ID

Run this in the Supabase SQL Editor (replace the email):

```sql
SELECT id, email, created_at
FROM   auth.users
WHERE  email = 'your-founder-email@example.com';
```

Copy the `id` value — that is your Supabase user UUID. You will use it in step 2.

If the query returns zero rows, you have not yet signed up at `/signup` in this environment. Do that first, then retry this query.

## Step 2 — Insert the founder_admin row

> **Important:** Run this in the Supabase SQL Editor (which uses the service role implicitly) or via `psql` connected with the `SUPABASE_SERVICE_ROLE_KEY` connection string. Anon-key clients are blocked by RLS — that is by design.

Replace `<UUID>`, `<NAME>`, `<EMAIL>`:

```sql
INSERT INTO public.team_members
  (user_id, role, status, full_name, email)
VALUES
  ('<UUID-from-step-1>',
   'founder_admin',
   'active',
   '<your full name>',
   '<your-founder-email@example.com>');
```

If you ever need to re-run this on an environment where the row may already exist, use `ON CONFLICT` to make it idempotent:

```sql
INSERT INTO public.team_members
  (user_id, role, status, full_name, email)
VALUES
  ('<UUID-from-step-1>', 'founder_admin', 'active', '<your full name>', '<your-founder-email@example.com>')
ON CONFLICT (user_id) DO UPDATE
  SET role       = EXCLUDED.role,
      status     = EXCLUDED.status,
      full_name  = EXCLUDED.full_name,
      email      = EXCLUDED.email,
      updated_at = now();
```

## Step 3 — Verify the row

```sql
SELECT id, user_id, role, status, full_name, email, created_at
FROM   public.team_members
WHERE  role = 'founder_admin';
```

Expected result: exactly one row, with your email and `status = 'active'`.

Also verify the `is_founder_admin()` helper resolves correctly. The Supabase SQL Editor runs as a privileged role, so to actually test this you need to issue a request from the app while signed in — but you can sanity-check the function exists:

```sql
SELECT prosrc IS NOT NULL AS is_present
FROM   pg_proc
WHERE  proname = 'is_founder_admin';
```

## Step 4 — Avoid lockout

A few protections are built into the codebase to prevent permanent lockout:

| Protection | Where |
|---|---|
| The migration is idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) — re-running it never deletes the founder row. | `supabase/migrations/20260518120000_create_team_members.sql` |
| `requireTeam()` redirects unauthenticated users to `/team/login` instead of erroring. | `lib/auth/require-team.ts` |
| `requireAdmin()` only redirects non-founders to `/team/dashboard?error=admin_only`; it never deletes their session. | `lib/auth/require-admin.ts` |
| Mock auth (`HELIOS_ENABLE_MOCK_AUTH=true`) bypasses the founder row but is hard-disabled in `NODE_ENV === 'production'`. | `lib/auth/mock-session.ts` |

**Recovery path if you lock yourself out of production:**

1. The service role key bypasses RLS. From the Supabase SQL Editor, run the `INSERT … ON CONFLICT` block above (or a `DELETE` on the broken row followed by a fresh `INSERT`).
2. If the founder password is lost, use Supabase Auth → Users to send a magic link to the founder email.
3. Never grant `INSERT` on `team_members` to the `authenticated` role without `is_founder_admin()`. The migration's policies already enforce this; do not add a permissive insert policy.

## Step 5 — Disable mock auth in production

`HELIOS_ENABLE_MOCK_AUTH` is read by `lib/auth/mock-session.ts`. In production this flag is short-circuited:

```ts
export function mockAuthEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.HELIOS_ENABLE_MOCK_AUTH === 'true'
}
```

This means production deploys cannot accidentally fall back to mock auth even if the flag is set. To be defensive in your deploy config:

- **Vercel / Netlify**: ensure `HELIOS_ENABLE_MOCK_AUTH` is **not set** in the production environment. If set, it is ignored — but cleaning it up removes noise.
- **Local dev**: only set `HELIOS_ENABLE_MOCK_AUTH=true` in `.env.local`. Never commit it to `.env`, `.env.production`, or any shared config.
- **CI**: the build does not require mock auth. Do not set the flag in CI.

## Step 6 — Confirm /admin/mission-control access

1. Sign out of any existing session (or open an incognito window).
2. Visit `/team/login` in the target environment.
3. Sign in with the founder email from step 1.
4. After successful sign-in, navigate to `/admin/mission-control`.
   - You should see the founder command center (KPI cards + preview panels).
   - You should **not** see "admin_only" or "not_authorized" in the URL.

Quick checks if something goes wrong:

| Symptom | Likely cause |
|---|---|
| Redirected to `/team/login` after sign-in | Step 2 was skipped or used a different `user_id` than step 1 returned. Re-run step 3 and confirm one row exists. |
| URL becomes `/team/dashboard?error=admin_only` | Sign-in worked but `role` is not `founder_admin`. Re-run the `INSERT … ON CONFLICT` block with `role = 'founder_admin'`. |
| URL becomes `/team/login?error=not_authorized` | A row exists for your `user_id` but `status` is not `active`. Update with `UPDATE public.team_members SET status='active' WHERE user_id='<UUID>';` |
| Sidebar shows admin nav but every page is 500 | Likely the migration did not run. Check `pg_policies` for entries on `team_members`. |

## Reference

- Migration: [`supabase/migrations/20260518120000_create_team_members.sql`](../supabase/migrations/20260518120000_create_team_members.sql)
- Server guards: [`lib/auth/require-team.ts`](../lib/auth/require-team.ts), [`lib/auth/require-admin.ts`](../lib/auth/require-admin.ts)
- Role permissions: [`lib/auth/permissions.ts`](../lib/auth/permissions.ts)
- Mock session (dev only): [`lib/auth/mock-session.ts`](../lib/auth/mock-session.ts)

## Security notes

- The application **never trusts** `role`, `user_id`, `team_member_id`, or `business_id` submitted from the client. All four are derived server-side from `supabase.auth.getUser()` and the corresponding database rows.
- RLS on `team_members` is enabled and forced (`FORCE ROW LEVEL SECURITY`), so even the table owner is subject to policies. Only the service role bypasses RLS — and the service-role key never reaches the browser (see `lib/supabase/server.ts`).
- The `is_founder_admin()` function is `SECURITY DEFINER` with a fixed `search_path = public`, so it cannot be hijacked by a malicious `search_path` injected via session settings.
- Don't share the service-role key. Treat it like a root credential.
