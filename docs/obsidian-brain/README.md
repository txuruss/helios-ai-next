# Helios AI Brain

This folder is the **source of truth** for the Helios AI Agency project.

It is structured as an Obsidian-compatible knowledge base. Every major decision, brand rule, system design, and operating procedure lives here. Claude Code must read the relevant notes in this folder before making any architectural, design, or feature decision.

---

## What this brain is for

- Keeping the project coherent across multiple Claude Code sessions
- Preventing hallucinated features, incorrect branding, or wrong tech stack assumptions
- Logging decisions so the "why" is never lost
- Defining how each part of the system works and connects
- Tracking open questions that must not be assumed

---

## How to update it

- When a major decision is made → add a row to [[08-decision-log]]
- When a feature is confirmed or removed → update [[10-feature-map]]
- When a new open question arises → add it to [[09-open-questions]]
- When branding rules change → update [[01-brand-identity]]
- When offers change → update [[02-offers-and-pricing]]
- When new agents are defined → update [[04-agent-workflows]]
- When the tech stack is confirmed → update [[05-tech-stack]]

Never delete existing entries. Mark them as superseded with a note instead.

---

## How Claude Code should use this brain

1. Before any edit, read [[00-source-of-truth]] and [[07-claude-code-rules]]
2. Before building Mission Control features, read [[03-mission-control]]
3. Before building agent workflows, read [[04-agent-workflows]]
4. Before making UI or brand decisions, read [[01-brand-identity]]
5. Before touching payments, auth, or database, verify against [[05-tech-stack]] and [[09-open-questions]]
6. After completing work, log the decision in [[08-decision-log]] and update [[10-feature-map]]

---

## How to avoid hallucinations

- If something is not confirmed in the codebase or in this brain → write "Needs verification"
- Do not invent routes, features, or integrations
- Do not assume Relevance AI is connected unless [[05-tech-stack]] says it is confirmed
- Do not assume pricing is finalized unless [[02-offers-and-pricing]] says so
- Always distinguish between **confirmed** (visible in code/files) and **planned** (intended but not built)

---

## How decisions should be logged

Use [[08-decision-log]] with this format:

| Date | Decision | Reason | Status | Impact | Related |
|------|----------|--------|--------|--------|---------|

Mark each decision as one of: **Active**, **Superseded**, **Paused**, or **Reversed**.

---

## How to use backlinks in Obsidian

Links use double bracket syntax: `[[filename-without-extension]]`

Open this vault in Obsidian by pointing it at the `docs/obsidian-brain/` folder. All notes will appear in the file explorer and backlinks panel automatically.

---

## Navigation

See [[index]] for the full note map.
