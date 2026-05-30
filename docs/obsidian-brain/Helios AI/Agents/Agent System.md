# Agent System

## Summary

The planned Helios AI agent workflow researches a business, audits its website, qualifies it, and — for good-fit leads — builds an offer and outreach, with a quality check and admin notification at the end. Status updates flow back into [[Mission Control]].

> Detailed, code-aligned agent specs (inputs/outputs/approval gates) live in [[04-agent-workflows]]. This note is the business-level map.

## Current status

`Planned` — execution is intended to run on Relevance AI, which is **not connected** yet (see [[Relevance AI]]). Treat all agents as planned until verified.

## Workflow

```
User Message Trigger
    ↓
Helios AI Business Research Agent
    ↓
Helios AI Website Audit Agent
    ↓
Helios AI Client Qualifier Agent
    ↓
Qualification Decision
```

### Branches

**Hot / Warm Lead**
- Helios AI Sales Offer Builder Agent
- Helios AI Content & Outreach Agent
- Helios AI Quality Check Tool
- Helios AI Admin Notification
- Helios AI Client Status Update Tool

**Low Priority**
- Helios AI Admin Notification
- Helios AI Client Status Update Tool

**Poor Fit**
- Helios AI Client Status Update Tool

## Agent roles

| Agent / Tool | Role |
|---|---|
| **Business Research Agent** | Finds basic business info, services, website, contact channels, booking method, and possible missed-lead problems. |
| **Website Audit Agent** | Audits the website, booking page, lead capture, service clarity, trust signals, response-speed risk, and automation opportunities. |
| **Client Qualifier Agent** | Scores fit based on urgency, lead volume, booking dependency, ability to pay, and automation fit. |
| **Sales Offer Builder Agent** | Turns audit + research into a clear offer, pitch, or proposal. |
| **Content & Outreach Agent** | Creates DM scripts, cold email drafts, follow-up messages, and personalized outreach. |
| **Quality Check Tool** | Checks output for accuracy, clarity, relevance, and whether the recommendation makes sense. |
| **Admin Notification Tool** | Sends important lead/client updates to the owner/admin. |
| **Client Status Update Tool** | Updates lead/client status in the database/dashboard. |

## Key decisions

- Agents are **decision-support and drafting** — no autonomous outreach or auto-conversion of leads without a human.
- Quality Check never approves its own output; a human confirms.

## Action items

- [ ] Connect Relevance AI ([[Relevance AI]]) before building against these agents
- [ ] Confirm Supabase tables each agent reads/writes exist
- [ ] Keep outbound messages human-approved

## See also

[[04-agent-workflows]] · [[Relevance AI]] · [[Mission Control]] · [[Outreach Strategy]]

---
*Last updated: 2026-05-29*
