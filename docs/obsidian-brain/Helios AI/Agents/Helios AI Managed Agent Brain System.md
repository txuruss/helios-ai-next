# Helios AI Managed Agent Brain System

## Summary

A useful AI agent is **not just a tool-execution bot — it needs a brain.** Most AI tools forget everything after a session ends. Helios AI agents should have a memory system that reads source files, saves decisions, updates client notes, tracks completed work, stores business context, continues from previous sessions, and improves over time. This is a **later** packaging opportunity — it must not distract from selling the first booking system.

## Status

`Planned` — direction for the agent layer, not a current build. The first offer ships first. See [[Agent System]] and [[04-agent-workflows]] for the current (planned/partial) agent design.

## Agent brain principle

Most AI tools forget what happened after the session ends. Helios AI agents should have a memory system that lets them:

- Read source files
- Save decisions
- Update client notes
- Track completed work
- Store business context
- Continue from previous sessions
- Improve over time

## Sleep-cycle concept

At the end of each working day, the agent runs a memory update. The sleep cycle should:

1. Review the day's conversations and actions
2. Summarize what changed
3. Update the relevant source files
4. Refresh client notes
5. Save next actions
6. Flag missing information
7. Prepare the next day's execution plan

## Helios agent memory files

The intended `/brain/` memory set. Some already exist in this vault; others are planned (`Needs verification` / to be created):

| Memory file | Status in this vault |
|-------------|----------------------|
| Helios AI Master Source | **Exists** as [[HQ]] (top-level hub / master index) |
| Helios AI Client Outreach & Acquisition Source | **Exists** → [[Helios AI Client Outreach & Acquisition Source]] |
| Helios AI Daily Outreach Dashboard | **Exists** → [[Helios AI Daily Outreach Dashboard]] |
| Helios AI Decision Log | **Exists** → [[Decision Log]] |
| Helios AI Next Actions | **Exists** as [[Next Steps]] |
| Helios AI Lead Scoring Rules | Planned — scoring lives in `/admin/outreach` UI today |
| Helios AI Discovery Call Notes | Planned — framework in [[Helios AI Discovery Call Framework]] |
| Helios AI Client Workspaces | Planned — client detail lives in admin Clients drawer today |
| Helios AI Agent Run Logs | Planned — agent runs not live yet ([[Relevance AI]] not connected) |

## Managed agent opportunity

Helios can eventually package **managed agents** for local businesses — e.g. a salon booking assistant that remembers services, pricing, FAQs, staff availability, customer preferences, missed inquiries, and owner instructions.

But this should not distract from the first offer.

- **First sell:** an AI booking and lead-response system.
- **Later expand into:** a managed AI front-desk agent with memory.

## See also

[[Agent System]] · [[04-agent-workflows]] · [[Relevance AI]] · [[HQ]] · [[Helios AI Founder Operating Rules]]

---
*Last updated: 2026-05-30*
