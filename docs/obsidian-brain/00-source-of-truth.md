# Source of Truth — Helios AI Agency

This note defines the non-negotiable operating rules for this project. All Claude Code sessions, contributors, and AI agents must follow these rules.

---

## Active project

**The active project is Helios AI Agency.**

- Do not rebrand to any other name unless the user explicitly requests it in writing.
- Do not reference previous project names, codebases, or experiments.
- All new features, copy, and systems must be built under the Helios AI Agency identity.

---

## Core rules

### Do not invent features
- Only build what has been explicitly requested.
- Do not assume a feature exists unless it is visible in the codebase or confirmed in [[10-feature-map]].
- Do not build new features unless a clear request has been made.

### Do not remove or rename without approval
- Never delete files, routes, components, database columns, or API endpoints without explicit user approval.
- Never rename routes, pages, or functions without approval.
- If something looks unused or outdated, flag it and ask — do not delete it.

### Preserve existing code
- Existing app features take priority.
- When adding new features, do not break, wrap, or silently override existing behavior.
- Read the file before editing it.

### Separate confirmed facts from assumptions
- **Confirmed**: visible in the current codebase files.
- **Planned**: in this brain but not yet in code.
- **Assumed**: not proven by either — must be verified before acting.

Always label assumptions clearly. Write "Needs verification" if unsure.

### Prioritize sellable systems over random features
- Builds should serve one of the three main offer packages from [[02-offers-and-pricing]].
- Do not build internal tooling, experiments, or "nice to have" features ahead of delivery systems.
- If a feature does not help onboard, serve, or retain a client — it waits.

---

## What requires explicit approval before changing

- Auth system
- Payments and Stripe integration
- Database schema (Supabase)
- API routes under `/api/`
- Middleware (`middleware.ts`)
- Environment variables
- Production secrets
- Hosting config (`netlify.toml`, `vercel.json`)
- Next.js config (`next.config.ts`)

---

## Related notes

- [[01-brand-identity]] — Brand rules
- [[02-offers-and-pricing]] — What we sell
- [[07-claude-code-rules]] — Code-level operating rules
- [[08-decision-log]] — Decision history
- [[09-open-questions]] — Items not yet confirmed
