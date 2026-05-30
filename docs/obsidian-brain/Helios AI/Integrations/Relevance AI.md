# Relevance AI

## Summary

Relevance AI will eventually power the **audit and lead-processing workflow** — analyzing each business that submits an audit, scoring the lead, and generating an audit summary that surfaces inside [[Mission Control]].

## Current status

`In progress` — built in code, not connected.

- A manual **"Run AI Audit"** processor is **built in code** (on `/admin/audits`): a founder can trigger analysis of an audit row, and the structured result is saved and displayed.
- The integration is **not live** — the required environment variables are **not set**, so the button shows "Not connected."
- This integration can be **delayed until after client acquisition starts**. It is not required for outreach.

> Do not mark Relevance AI as fully connected. It is built but not wired to a live agent.

## Environment variable

The needed environment variable is:

```
RELEVANCE_AI_AGENT_ID=
```

- The value must come from the **specific Relevance AI agent setup** — do **not** guess it.
- The agent URL was found inside Relevance AI (Your Agent → API).
- Also used: `RELEVANCE_AI_API_KEY`, `RELEVANCE_AI_REGION` (default `us-east-1`), optional `RELEVANCE_AI_PROJECT_ID`, optional `RELEVANCE_AI_TRIGGER_URL`. Legacy `RELEVANCE_*` names are used as a fallback.
- **Server-side only** — never expose to the browser (never `NEXT_PUBLIC_`).
- Netlify environment variables will eventually store the Relevance AI credentials.

## Future flow

```
Audit Form Submission
    ↓
Store lead/audit record
    ↓
Trigger Relevance AI Agent
    ↓
Analyze business
    ↓
Score lead
    ↓
Generate audit summary
    ↓
Notify admin inside Mission Control
    ↓
Update lead/client status
```

## Key decisions

- Relevance AI is **deferred** — outreach starts without it. (See [[Decision Log]] and [[Client Acquisition Readiness]].)
- The processor never fabricates results: unusable agent output is saved as a "failed" run with an error, not faked.
- No autonomous outreach or auto-conversion of leads — the audit processor is **decision-support only**.

## Action items

- [ ] Set `RELEVANCE_AI_API_KEY` + `RELEVANCE_AI_AGENT_ID` in Netlify env
- [ ] Apply the `admin_audit_ai_results` migration in Supabase
- [ ] Confirm the agent returns the structured fields the processor expects
- [ ] Wire audit submission to auto-trigger the agent (currently manual)

## See also

[[Mission Control]] · [[Agent System]] · [[System Architecture]] · [[PayPal]] · [[04-agent-workflows]]

---
*Last updated: 2026-05-29*
