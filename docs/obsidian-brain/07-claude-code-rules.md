# Claude Code Rules — Helios AI Agency

See also: [[00-source-of-truth]] | [[05-tech-stack]] | [[09-open-questions]]

These rules are non-negotiable. Every Claude Code session working on this project must follow them.

---

## Before making any change

- [ ] Read [[00-source-of-truth]] first
- [ ] Read the file you are about to edit — use the Read tool before any Edit
- [ ] Confirm the feature or route you are working on exists in the codebase
- [ ] Check [[10-feature-map]] to verify the feature status (confirmed / planned / unconfirmed)
- [ ] Check [[09-open-questions]] for any open items that might affect your work

---

## Preserve existing features

- Do not remove, rename, or silently override any existing component, route, API handler, or database function
- If you are replacing something, state what you are replacing and why — and get approval first
- If something looks unused, flag it — do not delete it

---

## Do not delete without approval

This rule is absolute:

- No deleting files
- No deleting routes
- No dropping database tables or columns
- No removing environment variable references
- No removing package dependencies
- No removing middleware rules

If deletion is necessary, present the case to the user and wait for explicit approval.

---

## Do not invent project facts

- Do not assume a feature exists that you cannot see in the codebase
- Do not assume a third-party integration is connected unless it is confirmed in [[05-tech-stack]]
- Do not write documentation or comments about features that are "planned"  as if they are live
- Do not assume pricing, offers, or agent designs are finalized unless confirmed here

Write "Needs verification" where uncertain.

---

## Ask before changing architecture

Any of the following require explicit user approval before touching:

- Database schema changes (Supabase)
- New API routes or removal of existing ones
- Changes to auth flow (`app/(auth)/`, `middleware.ts`, `lib/auth/`)
- Changes to payment flow (`lib/stripe/`, `app/api/stripe/`)
- Changes to `next.config.ts`, `middleware.ts`, `netlify.toml`, `vercel.json`
- Adding new third-party integrations or packages
- Changes to environment variable names or references

---

## Keep changes scoped

- Fix what was asked. Do not refactor surrounding code unless asked.
- Do not "clean up" files you are passing through.
- Do not add abstractions, helpers, or utilities unless they are required for the current task.
- Do not redesign UI components when a small edit will do.
- One thing at a time. Complete and verify before moving to the next task.

---

## After completing work

Always provide:

1. **Files modified** — list every file that was changed, with the path
2. **What changed** — one sentence per file
3. **Test checklist** — specific steps the user can take to verify the change works
4. **Assumptions made** — anything that was inferred, not confirmed
5. **Open questions** — anything that still needs verification

---

## Test checklist format

After every code change, provide a checklist like this:

```
## Test steps

- [ ] Load [route] in the browser
- [ ] Verify [specific behavior] works
- [ ] Check [edge case] does not break
- [ ] Confirm no console errors appear
- [ ] Check Sentry for any new errors
```

---

## Protect critical systems

Never modify these without explicit approval and careful review:

| System | Files to protect |
|--------|-----------------|
| Auth | `lib/auth/`, `app/(auth)/`, `middleware.ts` |
| Payments | `lib/stripe/`, `app/api/stripe/` |
| Database | `lib/supabase/`, `supabase/schema.sql`, all migration files |
| API routes | All files under `app/api/` |
| Production config | `.env.local`, `netlify.toml`, `vercel.json`, `next.config.ts` |
| Rate limiting | `lib/rate-limit/` |

---

## Separate confirmed facts from assumptions

In every response, clearly label:

- **Confirmed** — visible in codebase right now
- **Planned** — in this brain but not in code
- **Assumed** — inferred, not proven — must say "Needs verification"

Never present assumptions as confirmed facts.

---

## Code style

- TypeScript only — no plain `.js` files in the app
- Tailwind for all styling — no inline styles, no CSS modules unless they already exist
- Use existing `lib/` utilities before writing new ones
- Follow the existing file naming convention of the directory you are working in
- Do not introduce new patterns (state managers, fetching libraries) without approval
- Server components by default in Next.js App Router; use `"use client"` only when necessary

---

## Related notes

- [[00-source-of-truth]] — Business operating rules
- [[05-tech-stack]] — What is and is not in the stack
- [[08-decision-log]] — Past decisions to learn from
- [[09-open-questions]] — Items that need clarification before acting
