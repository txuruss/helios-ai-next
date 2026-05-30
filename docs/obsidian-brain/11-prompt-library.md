# Prompt Library — Helios AI Agency

See also: [[07-claude-code-rules]] | [[00-source-of-truth]]

Reusable Claude Code prompt templates for common tasks. Copy the relevant template and fill in the bracketed placeholders before sending.

---

## Safe UI update

```
Before making any changes, read docs/obsidian-brain/07-claude-code-rules.md and docs/obsidian-brain/00-source-of-truth.md.

Task: Update the UI on [route or component path].

What to change: [describe the change clearly]

Rules:
- Do not break any existing functionality
- Do not remove or rename existing props, routes, or components
- Use Tailwind CSS only — no inline styles
- Follow the existing visual style (dark, premium, gold/cyan accents — see docs/obsidian-brain/01-brand-identity.md)
- Read the file before editing it
- Do not refactor surrounding code

After the change, provide:
1. Files modified
2. What changed (one sentence per file)
3. Test steps to verify
4. Any assumptions made
```

---

## Safe backend update

```
Before making any changes, read docs/obsidian-brain/07-claude-code-rules.md and docs/obsidian-brain/05-tech-stack.md.

Task: Update backend logic at [file path or route].

What to change: [describe the change clearly]

Rules:
- Do not modify auth, payments, or database schema without explicit approval
- Do not add new packages
- Use the existing Supabase client from lib/supabase/
- Do not break existing API contracts (request/response shape)
- Validate inputs using Zod where appropriate
- Read the file before editing

After the change, provide:
1. Files modified
2. What changed
3. Test steps
4. Any assumptions made
5. Any database changes required
```

---

## Landing page improvement

```
Before making any changes, read docs/obsidian-brain/01-brand-identity.md and docs/obsidian-brain/07-claude-code-rules.md.

Task: Improve the landing page at app/(public)/page.tsx.

What to change: [describe the change]

Brand rules to follow:
- Dark premium SaaS aesthetic (deep navy, near-black backgrounds)
- Gold accents for primary CTAs (#C9A84C range)
- Cyan/electric blue for AI accents
- No random emojis
- No cheap robot imagery
- No buzzword-heavy copy
- Strong whitespace and clean typography
- One primary CTA per section

Do not:
- Remove existing sections without approval
- Change route structure or file names
- Break existing form submissions or API calls

After the change:
1. Files modified
2. What changed
3. Visual test steps
4. Assumptions made
```

---

## Mission Control feature build

```
Before starting, read:
- docs/obsidian-brain/03-mission-control.md
- docs/obsidian-brain/07-claude-code-rules.md
- docs/obsidian-brain/05-tech-stack.md

Task: Build [specific Mission Control section or widget].

Confirmed route: app/admin/mission-control/page.tsx (or sub-route)

Requirements: [describe what the feature should do]

Data source: [Supabase table or API endpoint — confirm it exists before writing code]

Rules:
- Read all files before editing
- Use existing Supabase client from lib/supabase/
- Use Tailwind for all styling
- Follow the dark premium admin UI style
- Do not create new database tables without confirming the schema first
- Do not add new packages

After the change:
1. Files modified
2. What changed
3. Test steps
4. Database tables or queries used
5. Assumptions or items needing verification
```

---

## Agent workflow implementation

```
Before starting, read:
- docs/obsidian-brain/04-agent-workflows.md
- docs/obsidian-brain/05-tech-stack.md
- docs/obsidian-brain/09-open-questions.md

Task: Implement [agent name] workflow.

Execution layer: Relevance AI (confirm connection status before proceeding — see 09-open-questions.md)

What the agent should do: [describe]
Inputs: [list]
Outputs: [list]
Human approval points: [list]

Rules:
- Do not build against Relevance AI as connected unless confirmed
- Do not auto-send any client-facing message without a human approval gate
- Use lib/relevance/ for API calls
- Log all runs to the database
- Do not expose API keys in responses

After the change:
1. Files modified
2. Agent trigger and execution flow explained
3. Test steps
4. Human approval gates confirmed
5. Assumptions made
```

---

## Bug fix

```
Before starting, read docs/obsidian-brain/07-claude-code-rules.md.

Bug: [describe the bug — what happens vs what should happen]

File(s) likely involved: [paths if known]

Rules:
- Read the file before editing
- Fix only what is broken — do not refactor surrounding code
- Do not change interfaces, types, or API contracts unless required for the fix
- Do not break any other feature while fixing this one

After the fix:
1. Root cause identified
2. Files modified
3. What changed
4. Test steps to verify the fix
5. Regression check: what to verify was not broken
```

---

## Refactor without breaking features

```
Before starting, read docs/obsidian-brain/07-claude-code-rules.md and docs/obsidian-brain/00-source-of-truth.md.

Refactor task: [describe what to refactor and why]

Scope: [exact files or directory]

Rules:
- Do not change external behavior — inputs and outputs must remain identical
- Do not rename public-facing routes, API endpoints, or exported function signatures
- Do not remove functionality
- Keep Tailwind class changes minimal if any UI is touched
- Do not add new dependencies

After refactor:
1. Files modified
2. What changed
3. What was NOT changed (to confirm scope was respected)
4. Test steps
5. Any risks identified
```

---

## Documentation update

```
Before starting, read docs/obsidian-brain/README.md and docs/obsidian-brain/00-source-of-truth.md.

Task: Update documentation at [file path].

What to update: [describe]

Rules:
- Do not modify any app code
- Do not invent facts — only document what is confirmed or clearly mark assumptions as "Needs verification"
- Use clean Markdown, headings, and tables
- Add backlinks to related brain notes using [[note-name]] format where relevant
- Do not delete existing content — add to it or supersede with a note

After the update:
1. Files updated
2. What changed
3. Any items marked as Needs verification
```
