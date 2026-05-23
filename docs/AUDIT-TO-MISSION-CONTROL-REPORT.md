# Audit-to-Mission-Control Flow Report

Generated: 2026-05-23  
Scope: Inspect-only. No code was changed to produce this report.

---

## 1. Current Audit Route Structure

| Route | File | Purpose |
|---|---|---|
| `/audit` | `app/(public)/audit/page.tsx` | Public entry point. Shows audit preview checklist. No form here. |
| `/register-business` | `app/(public)/register-business/page.tsx` | The actual intake form. Reached from `/audit` via `?from=audit` param. |
| `/register-business/submitted` | `app/(public)/register-business/submitted/page.tsx` | Confirmation page for direct `/register-business` visits. |
| `/audit/submitted` | `app/(public)/audit/submitted/page.tsx` | Confirmation page for the `/audit` funnel. Shows booking CTA. |
| `/admin/audits` | `app/admin/audits/page.tsx` | Founder intake table. Full list of `audit_submissions` rows. |
| `/admin/mission-control` | `app/admin/mission-control/page.tsx` | Founder command center. Shows latest 6 submissions + KPI strip. |

---

## 2. Current Audit Form Location

**Confirmed:** The audit form is NOT at `/audit`. It is at `/register-business`.

The `/audit` page is a pre-sell/preview page. Its only call-to-action is:

```tsx
<Link href="/register-business?from=audit" ...>
  Start My Free Business Audit
</Link>
```

The `?from=audit` parameter is the only mechanism that distinguishes the audit flow from a direct registration visit.

---

## 3. Current Form Submission Handler

**File:** `lib/actions/registration.ts`  
**Function:** `submitBusinessRegistration(formData: FormData)`

Flow:
1. Parses `FormData` entries into a plain object
2. Splits comma-separated `services` and `preferred_channels` CSV strings into arrays
3. Validates with Zod (`lib/validation/registration.ts`)
4. Guards for `SUPABASE_SERVICE_ROLE_KEY` presence
5. Builds the `audit_submissions` row, converting empty strings to `null`
6. Inserts via `createServiceRoleClient()` — bypasses RLS for public form posts
7. Calls `notifyInternalTeam()` (non-fatal — currently a console.log stub only)
8. Returns `{ ok: true, submission_id: uuid }` on success

Error handling: insert failures return a safe user-facing message; raw Supabase errors are server-side only. The submission is NEVER silently swallowed — failure is surfaced to the form.

---

## 4. Whether the Audit Flow Saves to Supabase

**Confirmed: YES**, assuming both conditions are met:
1. `SUPABASE_SERVICE_ROLE_KEY` is set in the environment
2. The migration `supabase/migrations/20260520120000_create_audit_submissions.sql` has been applied to the Supabase project

If the table does not exist, the server action returns a friendly error:  
`"Audit intake is currently unavailable. Please try again in a few minutes."`

The `/admin/audits` and `/admin/mission-control` pages both show a prominent warning banner with the migration filename if the table is missing — so the failure is visible to the founder.

**Cannot verify from code alone:** Whether the migrations are actually applied to the live Supabase instance. This must be checked in the Supabase dashboard.

---

## 5. Which Supabase Table Receives the Data

**Table:** `public.audit_submissions`

**Migration file:** `supabase/migrations/20260520120000_create_audit_submissions.sql`

Key columns and their form field sources:

| DB Column | Form Field | Notes |
|---|---|---|
| `business_name` | `business_name` | Required. Only NOT NULL column. |
| `contact_name` | `contact_name` | Optional |
| `email` | `contact_email` | Optional |
| `industry` | `industry` (dropdown) | Optional |
| `city` | `city` | Optional |
| `country` | `country` | Default: Jamaica |
| `website` | `website` | URL validated |
| `instagram` | `instagram` | Optional |
| `facebook` | `facebook` | Optional |
| `whatsapp` | `whatsapp` | Optional |
| `current_booking` | `current_booking` | Optional |
| `monthly_leads` | `monthly_leads` | Stored as text |
| `biggest_problem` | `biggest_problem` | Optional |
| `services_offered` | `services` (state-managed) | CSV joined, max 2000 chars |
| `business_hours` | `business_hours` | Optional |
| `team_size` | `team_size` | Stored as text |
| `existing_booking_software` | `existing_software` | Optional |
| `preferred_channels` | `preferred_channels` | `text[]`, multi-select |
| `selected_plan` | `selected_plan` | Dropdown: starter / pro / scale |
| `source` | hardcoded | Always `'website'` |
| `status` | hardcoded | Always `'new'` on insert |
| `priority` | hardcoded | Always `'normal'` on insert |

---

## 6. Current Business Registration Flow

The `/register-business` page is a **general-purpose intake form** that serves two purposes:

1. **Direct registration** — User visits `/register-business` or `/register-business?plan=pro`. Submits. Redirects to `/register-business/submitted`.
2. **Audit funnel** — User visits `/audit`, clicks CTA, arrives at `/register-business?from=audit`. Submits. Redirects to `/audit/submitted`.

The routing logic is in `RegistrationForm.tsx`:

```tsx
const destination = params.get('from') === 'audit'
  ? '/audit/submitted'
  : '/register-business/submitted'
router.push(`${destination}${ref}`)
```

Both paths write to the **same table** (`audit_submissions`) via the **same server action**.

---

## 7. Whether /audit and /register-business Are Separate or Connected

**Connected, but separated by URL parameter only.**

- `/audit` is a marketing page. It has no form.
- `/register-business` has the form and handles both paths.
- The `?from=audit` parameter in the URL controls the post-submit redirect destination.
- Both paths insert into the same `audit_submissions` table with `source='website'`.

There is **no database distinction** between an audit submission and a direct registration — they land in the same table with the same `source` value. The founder cannot tell from Mission Control which path the business came through.

**Minor gap:** The `source` column always receives `'website'` regardless of whether the user came via `/audit` or `/register-business`. Adding `'audit'` vs `'registration'` as source values would allow the founder to filter by funnel, but this requires a schema change (the `source` column is currently free text, no CHECK constraint — so the server action could safely send a different value without a migration).

---

## 8. Whether /audit/submitted Works Correctly

**Confirmed: Works correctly with one dependency.**

The page (`app/(public)/audit/submitted/page.tsx`):
- Reads `?audit=` search param and displays the submission UUID as a reference
- Reads `process.env.NEXT_PUBLIC_BOOKING_LINK` server-side
  - **If set:** renders a "Schedule Your Audit Call" button linking to the booking URL
  - **If not set:** renders a fallback text: "Your audit has been submitted. We will contact you to schedule the next step."

**Dependency:** `NEXT_PUBLIC_BOOKING_LINK` must be set in `.env.local` (and in the production deployment environment) for the booking CTA to appear. If it is not set, the page still works — it just shows the fallback message.

---

## 9. Whether Mission Control Reads From the Same Data Source

**Confirmed: YES.**

Both `/admin/mission-control` and `/admin/audits` read from `public.audit_submissions` via two functions in `lib/data/admin-audits.ts`:
- `getAdminAuditMetrics()` — count-only queries for the KPI strip
- `getLatestAdminAuditSubmissions(6)` — latest 6 rows for the Mission Control preview table
- `getAdminAuditTableRows({ limit: 100 })` — full table for `/admin/audits`

All three use `createServiceRoleClient()` behind `requireAdmin()`.

---

## 10. Whether Submitted Audits Appear in Mission Control

**Confirmed: YES**, assuming the table exists and the service role key is configured.

When a business submits the form:
1. A row is inserted into `audit_submissions` with `status='new'`
2. The Mission Control "New audits today" KPI increments
3. The "Latest audit submissions" table on Mission Control shows the new row
4. The full `/admin/audits` table shows the row with Mark Reviewed / Convert / Archive actions

No manual refresh is needed — the pages are server-rendered on every visit.

---

## 11. Any Broken Redirects

**No broken redirects found.** All routes exist and are wired:

- `/audit` → links to `/register-business?from=audit` ✓
- Form submit with `from=audit` → `/audit/submitted?audit={uuid}` ✓
- Form submit without `from=audit` → `/register-business/submitted?audit={uuid}` ✓
- `/admin/audits` → action buttons revalidate and re-render ✓

---

## 12. Any Missing Fields

**One missing field worth noting:**

The admin table in `/admin/audits` has an **Industry** column header but renders `row.business_type`:

```tsx
<th>Industry</th>
...
<td>{row.business_type ?? '—'}</td>
```

The `toAdminAuditRow()` function correctly populates `business_type` from `industry || business_type` (preferring `industry`, which is what the form captures). This works correctly at runtime, but the naming is internally inconsistent: the DB column and form field are both called `industry`, yet the TypeScript layer renames it to `business_type` in the `AdminAuditRow` interface.

**No data is lost** — just a naming mismatch in the data layer that could confuse future contributors.

---

## 13. Any Duplicate or Confusing Flows

### A. Two public entry points, one form

The nav has "Free Audit" as a text link and the hero has "Start Free Business Audit" — both go to `/audit`. However, the Pricing section links to `/register-business?plan=pro` etc., and `/choose-plan` also leads there. A visitor could arrive at the form through multiple paths with different `?from=` or `?plan=` states. The result is always the same Supabase insert, but the confirmation page differs.

### B. Form heading says "Business Registration" when accessed via audit funnel

When a user arrives at `/register-business?from=audit`, the page heading says:
> "Tell us about your business"

with the eyebrow label "Business Registration" — not "Audit Request." This feels disconnected from the `/audit` page they came from. The form content is also full-featured (plan selection, full operations questions), which may feel premature for a cold lead expecting a simple audit form.

### C. Selected plan selector in the audit form

The audit form (`/register-business`) includes a "Selected Plan" dropdown (Starter / Booking OS / Ops Center). For a prospect arriving from the `/audit` page expecting a free audit, being asked to pick a paid plan immediately may be premature or confusing.

### D. `/register-business/submitted` copy says "audit"

The legacy confirmation page at `/register-business/submitted` says:
> "Your audit is queued. Our team is reviewing your business and we will email your report within one business day."

The word "audit" appears here even for visitors who did NOT come via the `/audit` funnel — i.e., direct `/register-business` visitors. This is arguably correct (the form does trigger an audit), but it is slightly inconsistent with the page title "Registration Received."

### E. No source distinction between audit and registration submissions

In Mission Control, the founder cannot filter or distinguish which submissions came via `/audit` vs `/register-business` directly. The `source` column is always `'website'`. This is a gap but not a bug.

---

## 14. Files Involved

| File | Role |
|---|---|
| `app/(public)/audit/page.tsx` | Public audit preview page |
| `app/(public)/register-business/page.tsx` | Form host page |
| `app/(public)/register-business/RegistrationForm.tsx` | Client form component + submit handler |
| `app/(public)/register-business/submitted/page.tsx` | Legacy confirmation page |
| `app/(public)/audit/submitted/page.tsx` | Audit funnel confirmation page |
| `lib/actions/registration.ts` | Server action: validates + inserts `audit_submissions` |
| `lib/validation/registration.ts` | Zod schema for the intake form |
| `lib/actions/admin-audits.ts` | Server actions: mark reviewed / convert / archive |
| `lib/data/admin-audits.ts` | Data layer: reads from `audit_submissions` |
| `lib/data/admin-mission-control.ts` | Data layer: KPIs for Mission Control |
| `lib/relevance/relevance-service.ts` | `notifyInternalTeam()` — currently a stub |
| `lib/whatsapp/client.ts` | WhatsApp client — uses `META_ACCESS_TOKEN` |
| `app/admin/audits/page.tsx` | Founder audit intake table |
| `app/admin/audits/AuditActionsCell.tsx` | Row-level action buttons |
| `app/admin/mission-control/page.tsx` | Founder command center |
| `app/admin/layout.tsx` | Admin layout — applies `requireAdmin()` |
| `lib/auth/require-admin.ts` | Auth guard — `requireAdmin()` |
| `supabase/migrations/20260518120000_create_team_members.sql` | `team_members` table + `is_founder_admin()` |
| `supabase/migrations/20260520120000_create_audit_submissions.sql` | `audit_submissions` table + RLS |

---

## 15. Recommended Smallest Fix

The overall flow is well-architected. There is **one confirmed code bug**, **one missing env var**, and **two migration-dependent unknowns**.

### Priority order:

**1. Fix the WhatsApp health check env var (1-line change, no schema change)**

In `lib/data/admin-mission-control.ts`, line 52:

```ts
// CURRENT (wrong):
whatsapp: !!process.env.WHATSAPP_TOKEN || !!process.env.WHATSAPP_ACCESS_TOKEN,

// CORRECT (matches actual WhatsApp client and all other health checks):
whatsapp: !!process.env.META_ACCESS_TOKEN,
```

The rest of the codebase — `lib/whatsapp/client.ts`, `lib/actions/ops.ts`, `lib/actions/demo-qa.ts`, `lib/actions/production-readiness.ts` — all consistently use `META_ACCESS_TOKEN`. Only this one file uses the wrong name. The Mission Control health panel will show WhatsApp as "Not configured" even when it IS configured until this is fixed.

**2. Verify both migrations are applied in the Supabase dashboard**

In the Supabase SQL editor or via the CLI, confirm:
- `public.team_members` exists
- `public.audit_submissions` exists
- `public.is_founder_admin()` function exists

No code change needed — this is an environment action.

**3. Set `NEXT_PUBLIC_BOOKING_LINK` in `.env.local` and in the production environment**

```
NEXT_PUBLIC_BOOKING_LINK=https://your-calendly-or-cal-link.com
```

No code change needed. This unblocks the "Schedule Your Audit Call" CTA on `/audit/submitted`.

**4. Notify the founder on new submissions (follow-up pass)**

`notifyInternalTeam()` in `lib/relevance/relevance-service.ts` is a console.log stub. The founder has no real-time signal when a new submission arrives — they must manually check Mission Control. Wiring this to Resend (already in the stack) would be the smallest meaningful improvement to the operational flow, but it requires an email template and Resend configuration.

---

## Status Summary

| Area | Status |
|---|---|
| Public audit route | ✅ Works |
| Form data collection | ✅ Works |
| Zod validation | ✅ Works |
| Supabase insert (service role) | ✅ Works (if table exists + key configured) |
| Redirect after submit | ✅ Works |
| `/audit/submitted` page | ✅ Works (booking CTA needs env var) |
| Mission Control reads audit data | ✅ Works |
| `/admin/audits` table + actions | ✅ Works |
| Admin access control | ✅ Works |
| WhatsApp health check in Mission Control | ❌ Wrong env var (`WHATSAPP_TOKEN` vs `META_ACCESS_TOKEN`) |
| Founder notification on new submission | ❌ Stub only — no real notification sent |
| Submitter email confirmation | ❌ Not implemented |
| "Convert" action → real client | ⚠️ Partial — flips status only, no `businesses` row created |
| Source distinction (audit vs registration) | ⚠️ Both write `source='website'` — no funnel filter |
| Migration application | ❓ Cannot verify from code — check Supabase dashboard |
| `NEXT_PUBLIC_BOOKING_LINK` env var | ❓ Must be set manually for booking CTA to appear |
