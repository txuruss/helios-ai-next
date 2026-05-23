# Relevance AI Audit Integration Plan

**Status:** Phase 1 implemented — trigger wired, partial result storage active.
**Schema migration:** Pending approval before Phase 2 can proceed.

---

## 1. Current `audit_submissions` table fields

From `supabase/migrations/20260520120000_create_audit_submissions.sql`:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| business_name | text NOT NULL | |
| contact_name | text | |
| email | text | |
| phone | text | |
| industry | text | |
| business_type | text | |
| location | text | |
| city | text | |
| country | text | |
| website | text | |
| instagram | text | |
| facebook | text | |
| whatsapp | text | |
| current_booking | text | |
| monthly_leads | text | |
| biggest_problem | text | |
| services_offered | text | |
| business_hours | text | |
| team_size | text | |
| existing_booking_software | text | |
| preferred_channels | text[] | |
| selected_plan | text | |
| source | text NOT NULL | default 'website' |
| status | text NOT NULL | new / in_review / qualified / contacted / converted / archived |
| priority | text NOT NULL | **low / normal / high / urgent** ← writable today |
| qualification_score | integer | 0–100 ← writable today |
| notes | text | human notes — not used for AI output |
| linked_business_id | uuid | |
| linked_business_audit_id | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Fields that currently accept Relevance output (Phase 1):**
- `qualification_score` ← `fit_score`
- `priority` ← `priority`

**All other agent output fields are missing from the current schema.**

---

## 2. Current audit submission handler

**File:** `lib/actions/registration.ts`

Flow (post Phase 1):
1. Validate form data with Zod
2. Guard `SUPABASE_SERVICE_ROLE_KEY`
3. Build and insert `audit_submissions` row
4. Return early on insert failure (never silently swallow)
5. `notifyInternalTeam` + `sendAuditNotificationEmail` (non-fatal try/catch)
6. `triggerAuditQualifier` — calls Relevance AI, writes `qualification_score` + `priority` back (non-fatal try/catch)
7. Return `{ ok: true, submission_id }`

---

## 3. Where the Relevance call is inserted

**Location:** `lib/actions/registration.ts`, step 6, after line 156 (the existing notification try/catch).

The call is deliberately placed **after**:
- The DB insert succeeds (step 4)
- The founder email is sent (step 5)

This ensures the submission is always saved first and the email always fires before the agent run begins. A 20-second timeout via `AbortController` prevents a hung Relevance request from blocking the response.

---

## 4. Missing fields needed to store full agent results

The Helios AI Audit Qualifier Agent returns the following fields that **cannot currently be persisted**:

| Agent field | Suggested column | Type | Notes |
|---|---|---|---|
| `job_id` (async) | `agent_job_id` | text | Relevance run ID for async polling |
| trigger state | `agent_status` | text | pending / running / complete / failed / skipped |
| trigger timestamp | `agent_triggered_at` | timestamptz | when the trigger was fired |
| `main_problem_summary` | `ai_summary` | text | AI-generated problem summary |
| `recommended_offer` | `recommended_offer` | text | suggested Helios package/offer |
| `recommended_next_step` | `recommended_next_step` | text | concrete next action |
| `suggested_follow_up_message` | `suggested_follow_up_message` | text | draft outreach message |
| `internal_notes` | `ai_internal_notes` | text | separate from human `notes` |
| `risk_flags` | `risk_flags` | text[] | array of flag strings |
| `call_recommended` | `call_recommended` | boolean | agent recommendation |
| full raw output | `agent_output` | jsonb | complete response for reference |

---

## 5. Recommended smallest Supabase migration

```sql
-- Migration: add Relevance AI agent output columns to audit_submissions
-- Apply after: 20260520120000_create_audit_submissions.sql

ALTER TABLE public.audit_submissions
  ADD COLUMN IF NOT EXISTS agent_job_id            text,
  ADD COLUMN IF NOT EXISTS agent_status            text
    CHECK (agent_status IN ('pending', 'running', 'complete', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS agent_triggered_at      timestamptz,
  ADD COLUMN IF NOT EXISTS ai_summary              text,
  ADD COLUMN IF NOT EXISTS recommended_offer       text,
  ADD COLUMN IF NOT EXISTS recommended_next_step   text,
  ADD COLUMN IF NOT EXISTS suggested_follow_up_message text,
  ADD COLUMN IF NOT EXISTS ai_internal_notes       text,
  ADD COLUMN IF NOT EXISTS risk_flags              text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS call_recommended        boolean,
  ADD COLUMN IF NOT EXISTS agent_output            jsonb;

COMMENT ON COLUMN public.audit_submissions.agent_job_id       IS 'Relevance AI async job ID. Null for sync triggers or when agent is not configured.';
COMMENT ON COLUMN public.audit_submissions.agent_status       IS 'pending | running | complete | failed | skipped';
COMMENT ON COLUMN public.audit_submissions.ai_summary         IS 'AI-generated summary of the main business problem.';
COMMENT ON COLUMN public.audit_submissions.recommended_offer  IS 'Helios offer recommended by the qualifier agent.';
COMMENT ON COLUMN public.audit_submissions.ai_internal_notes  IS 'Internal notes generated by the AI qualifier (separate from human notes).';
COMMENT ON COLUMN public.audit_submissions.agent_output       IS 'Raw Relevance AI agent output stored for audit and reprocessing.';

CREATE INDEX IF NOT EXISTS audit_submissions_agent_status_idx
  ON public.audit_submissions (agent_status);
```

**Migration file to create:**
`supabase/migrations/20260524000000_audit_submissions_agent_columns.sql`
(use the actual date prefix when applying)

---

## 6. Files that would change after migration approval

| File | Change |
|---|---|
| `supabase/migrations/20260524000000_audit_submissions_agent_columns.sql` | New migration (above) |
| `lib/ai/relevance-audit-qualifier.ts` | No change needed — already returns all fields |
| `lib/actions/registration.ts` | Expand `updateFields` to include all new columns |
| `lib/data/admin-audits.ts` | Add new columns to the SELECT query for Mission Control |
| `app/admin/audits/page.tsx` | Display `ai_summary`, `recommended_offer`, `call_recommended`, etc. |

---

## 7. Exact implementation plan (Phase 2)

1. **Apply migration** — run `supabase/migrations/20260524000000_audit_submissions_agent_columns.sql` in Supabase.

2. **Update `registration.ts` step 6** — expand the `updateFields` block:
   ```typescript
   if (qualResult.ok) {
     const updateFields: Record<string, unknown> = {
       agent_status:       qualResult.job_id ? 'pending' : 'complete',
       agent_triggered_at: new Date().toISOString(),
     }
     if (qualResult.job_id)                      updateFields.agent_job_id            = qualResult.job_id
     if (qualResult.fit_score    !== null)        updateFields.qualification_score     = qualResult.fit_score
     if (qualResult.priority     !== null)        updateFields.priority                = qualResult.priority
     if (qualResult.main_problem_summary)         updateFields.ai_summary              = qualResult.main_problem_summary
     if (qualResult.recommended_offer)            updateFields.recommended_offer       = qualResult.recommended_offer
     if (qualResult.recommended_next_step)        updateFields.recommended_next_step   = qualResult.recommended_next_step
     if (qualResult.suggested_follow_up_message)  updateFields.suggested_follow_up_message = qualResult.suggested_follow_up_message
     if (qualResult.internal_notes)               updateFields.ai_internal_notes       = qualResult.internal_notes
     if (qualResult.risk_flags.length > 0)        updateFields.risk_flags              = qualResult.risk_flags
     if (qualResult.call_recommended !== null)    updateFields.call_recommended        = qualResult.call_recommended
     // Store raw output for debugging and future reprocessing
     updateFields.agent_output = JSON.stringify(qualResult)
     ...
   }
   ```

3. **Update `lib/data/admin-audits.ts`** — add new columns to the SELECT.

4. **Update `app/admin/audits/page.tsx`** — display `ai_summary`, `recommended_offer`, `call_recommended`, `risk_flags` in the audit review table.

5. **Test** with a live Relevance API key and verify the row is updated with both the job_id (async) or direct output (sync).

---

## 8. Risks and rollback plan

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Relevance API key not set | High (dev/staging) | Helper silently skips with log — submission always succeeds |
| Relevance timeout (>20s) | Low | AbortController kills request; submission unaffected |
| Agent returns unexpected field shapes | Medium | All extraction is defensive with `typeof` checks; unknown fields are dropped |
| Migration adds columns that conflict with future schema changes | Low | All new columns are nullable or have safe defaults |
| `agent_status` CHECK constraint blocks a new status value | Low | Add via `ALTER TABLE ... DROP CONSTRAINT ...; ADD CONSTRAINT ...` |

### Rollback

**Phase 1 rollback (current state):**
- Remove the `triggerAuditQualifier` call from `registration.ts` step 6
- Remove the import
- The helper file can remain — it has no side effects if not called

**Phase 2 rollback (after migration):**
- Revert `registration.ts` to Phase 1 version
- New columns are all nullable — no data is lost
- Migration is additive; there is no destructive rollback needed for the columns themselves
- If columns must be removed: `ALTER TABLE audit_submissions DROP COLUMN IF EXISTS <col>;` for each

---

*Generated after Phase 1 implementation. Approve the migration in section 5 to proceed to Phase 2.*
