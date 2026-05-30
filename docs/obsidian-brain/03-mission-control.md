# Mission Control — Helios AI Agency

See also: [[04-agent-workflows]] | [[10-feature-map]] | [[07-claude-code-rules]]

> **Business direction:** [[Helios AI/Mission Control]] is canonical for *why* Mission Control exists and its business purpose. This note stays canonical for **code/route facts**.

---

## Overview

Mission Control is the internal operating hub for the Helios AI Agency team. It gives the agency visibility into all active clients, leads, agents, and operations from a single interface.

**Confirmed route:** `app/admin/mission-control/page.tsx` exists in the codebase.

---

## Structure

```
Helios AI
└── Mission Control
    ├── Overview
    │   ├── Agency Snapshot
    │   ├── Active Leads
    │   ├── Active Clients
    │   ├── Pending Approvals
    │   ├── Agent Activity
    │   ├── Revenue Snapshot
    │   └── Critical Alerts
    ├── Teams
    │   ├── Sales Team
    │   ├── Delivery Team
    │   └── Admin Team
    ├── Agents
    │   ├── Lead Capture Agent
    │   ├── Sales Closer Agent
    │   ├── Client Onboarding Agent
    │   ├── Project Manager Agent
    │   └── Helios AI Orchestrator Agent
    ├── Agent Runs
    ├── Logs
    ├── Client Workspaces
    └── Settings
```

---

## Section breakdown

### Overview

The landing view when team members open Mission Control.

| Widget | What it shows |
|--------|--------------|
| Agency Snapshot | Total active clients, open leads, revenue MTD, team health |
| Active Leads | Leads currently in the pipeline — unqualified, in progress, ready to close |
| Active Clients | Clients currently onboarded and receiving services |
| Pending Approvals | Items awaiting human review (agent outputs, QA sign-offs, proposals) |
| Agent Activity | Recent agent runs, current agent status, errors or stalls |
| Revenue Snapshot | MRR, new MRR this month, churned MRR, outstanding invoices |
| Critical Alerts | System errors, failed agent runs, missed SLAs, billing failures |

---

### Teams

Internal team management layer.

| Section | Purpose |
|---------|---------|
| Sales Team | View assigned leads, call notes, close rates |
| Delivery Team | Active projects, delivery status, open tasks |
| Admin Team | Billing, client accounts, settings |

Build this after Overview is stable. Exact team roles depend on agency headcount.

---

### Agents

Each agent listed here corresponds to an AI agent defined in [[04-agent-workflows]].

| Agent | Display purpose |
|-------|----------------|
| Lead Capture Agent | Shows recent leads captured, source, status |
| Sales Closer Agent | Shows proposals sent, follow-ups pending, outcomes |
| Client Onboarding Agent | Shows onboarding steps completed per client |
| Project Manager Agent | Shows active delivery tasks, blockers, due dates |
| Helios AI Orchestrator Agent | Shows current orchestration state and recent runs |

**Important:** Agent execution happens in Relevance AI (planned — see [[05-tech-stack]]). Mission Control displays status and outputs — it does not run the agents itself unless directly integrated.

---

### Agent Runs

A log of all agent executions: which agent ran, when, what triggered it, what it returned, and whether human approval was needed.

- Useful for debugging and accountability
- Should show success/failure status per run
- Must never expose raw API keys or sensitive client data

---

### Logs

Full operational log stream for the agency:

- Lead events
- Client status changes
- Agent run history
- Billing events
- Error events
- Team actions

---

### Client Workspaces

Each client gets an isolated workspace view showing:

- Their AI assistant status
- Their booking system status
- Active conversations
- Upcoming follow-ups
- Delivery checklist progress
- Monthly optimization notes

**Confirmed routes:** `app/admin/clients/` and `app/client/` exist in the codebase.

---

### Settings

Agency-level settings:

- Team member management
- Notification preferences
- Integration keys (Relevance AI, WhatsApp, Cal.com)
- Billing config
- Agency branding

---

## What to build first

1. **Overview section** — Agency Snapshot, Active Leads, Active Clients, Critical Alerts
2. **Client Workspaces** — Individual client views with status and checklist
3. **Agent Activity widget** — Shows recent Relevance AI runs (once connected)
4. **Logs** — Filterable event stream

---

## What to build later

- Full Teams section (depends on agency team size)
- Agent management UI within Mission Control
- Revenue analytics beyond simple MRR snapshot
- Advanced approval workflows

---

## Related routes (confirmed in codebase)

- `app/admin/mission-control/page.tsx`
- `app/admin/clients/`
- `app/admin/leads/`
- `app/admin/audits/`
- `app/admin/delivery/`
- `app/admin/revenue/`
- `app/admin/relevance-ai/`
- `app/team/` — Team-facing mission control views
