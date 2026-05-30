# Mission Control

## Summary

Mission Control is the **internal admin dashboard** for running Helios AI — the operating system for managing leads, clients, audits, agents, payments, and delivery from one place.

> For the detailed, code-confirmed structure and confirmed routes, see the technical note [[03-mission-control]]. This note is the business-level overview.

## Current status

`In progress` — admin area exists. Route behaviour was corrected toward `/admin/mission-control`. Admin/dashboard pages should eventually be **login-gated**; the public landing page stays public.

## What Mission Control manages

- Agency Snapshot
- Active Leads
- Active Clients
- Pending Approvals
- Agent Activity
- Revenue Snapshot
- Critical Alerts
- Audit submissions
- Client status
- Agent runs
- Client delivery progress

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
    ├── Leads
    ├── Clients
    ├── Audits
    ├── Agents
    ├── Payments
    ├── Settings
    └── Logs
```

## Key decisions

- Mission Control is the internal operating system for Helios AI. (See [[Decision Log]].)
- Public landing page remains accessible; admin must be protected before launch.
- Revenue is always shown as **Estimated** until real payment reading exists (see [[PayPal]]).

## Action items

- [ ] Protect admin routes behind login
- [ ] Confirm audit submissions land in Audits view in production
- [ ] Connect Agent Activity to real Relevance AI runs once [[Relevance AI]] is configured

## See also

[[HQ]] · [[03-mission-control]] · [[Agent System]] · [[Relevance AI]] · [[PayPal]] · [[Website Improvement Backlog]]

---
*Last updated: 2026-05-29*
