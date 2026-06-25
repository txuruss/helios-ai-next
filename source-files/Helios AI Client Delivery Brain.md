# Helios AI Client Delivery Brain

The main operating brain for delivering client systems. Read this before starting any client build.

---

## Purpose

This document defines how Helios AI delivers working systems to clients quickly and reliably. It is the single source of truth for what we build, how we build it, and where the line is between scope and extra work. Every delivery decision should trace back to this file.

---

## What Helios AI delivers

Helios AI installs **AI booking and lead response systems** for local service businesses. The systems reply to inquiries fast, answer common questions, capture lead details, send booking links, notify the owner, and help turn inquiries into booked appointments — across website chat, WhatsApp, DMs, forms, and calls.

We deliver a working system, not a chatbot experiment. The goal is fewer missed leads and more booked appointments from week one.

---

## Core client outcome

**Stop missing leads. Reply faster. Book more appointments.**

Every system we ship must do at least these four things:
1. Reply to a new inquiry within seconds, 24/7.
2. Answer the business's most common questions accurately.
3. Capture the lead's name and contact details.
4. Notify the owner and/or route the lead toward a booking.

If a build does not improve these outcomes, it does not ship.

---

## Default client types

- Barbershops
- Hair and beauty salons
- Spas and wellness studios
- Nail studios
- Dental and aesthetic clinics
- Fitness studios and personal trainers
- Trades (plumbers, electricians, cleaners, landscapers)
- Local repair and service businesses

All share the same core pain: inquiries arrive across multiple channels and go unanswered, especially outside business hours.

---

## Default packages

| Package | Setup | Monthly | Core promise |
|---------|-------|---------|--------------|
| **Starter** | $999 | $249/mo | Stop missed inquiries. Reply to every lead 24/7. |
| **Booking OS** | $2,500 | $499/mo | Turn conversations into booked appointments. |
| **Ops Center** | $5,000 | $999/mo | Manage all conversations, bookings, and operations from one system. |

A discounted **first-client offer ($1,000–$1,500)** is used to land an early validation client — sell a simple Starter or light Booking OS, never Ops Center.

---

## Starter package scope

**Goal:** Stop missed inquiries and reply 24/7.

Included:
- Website AI chat widget
- FAQ answering trained on the business's info
- Lead capture (name, contact, enquiry type)
- Owner email notification on every new lead
- Basic client dashboard (view leads + chat history)

Not included: WhatsApp automation, booking integration, follow-up sequences, multi-location, analytics.

---

## Booking OS package scope

**Goal:** Turn conversations into booked appointments.

Included:
- Website AI chat widget
- WhatsApp assistant **or** email follow-up automation
- Booking request flow (Cal.com or similar)
- Lead capture with qualification questions
- Owner / team notifications
- Basic CRM / lead dashboard
- Monthly optimization review

Not included: multi-location reporting, advanced analytics, full operations automation.

---

## Ops Center package scope

**Goal:** Run all conversations, bookings, and operations from one system.

Included:
- Advanced business dashboard
- Full AI booking system
- Website chat + WhatsApp automation
- Client onboarding automation
- Follow-up automation sequences
- Analytics and reporting
- Priority support
- Monthly strategy review

Reserved for established, higher-volume businesses ready for a full ops layer.

---

## Core delivery rule

**A working simple system is better than a complicated unfinished system.**

Ship the minimum that delivers the core outcome, confirm it works, then expand only within the paid package. Never delay a launch to add features the client did not buy.

---

## Required client information

Collected via the [[Helios AI Client Intake Form]] before any build starts:

- Business name, type, and location(s)
- Owner and approval contact
- Services, prices, and durations
- Current booking method and booking link
- Lead sources and the missed-lead problem
- Top FAQs
- Opening hours
- Cancellation / deposit policies and payment methods
- Preferred assistant tone
- Notification preferences (email / WhatsApp)
- Dashboard users
- Launch deadline

If required information is missing, delivery does not start. Use the **Missing information message** in [[Helios AI Delivery Templates]].

---

## Default system components

1. **AI assistant** — answers FAQs, captures leads, routes to booking.
2. **Channels** — website chat always; WhatsApp on Booking OS / Ops Center.
3. **Lead capture** — stores name, contact, enquiry type, source.
4. **Booking flow** — booking link or request flow.
5. **Owner notifications** — email and/or WhatsApp on new lead and booking.
6. **Client dashboard** — leads, status, chat history.
7. **Human escalation** — handoff path when the AI cannot help.

---

## Delivery stages

1. Onboarding — payment, agreement, access (see [[Helios AI Client Onboarding Checklist]])
2. Intake — collect all business info (see [[Helios AI Client Intake Form]])
3. Setup — build the system (see [[Helios AI System Setup Framework]])
4. FAQ + flows — booking, WhatsApp, website chat SOPs
5. Testing — run all scenarios
6. Approval — client signs off
7. Launch — go live (see [[Helios AI Launch Readiness Checklist]])
8. Support + optimization (see [[Helios AI Revision & Support Process]])

---

## Common client questions

- **"How fast does it reply?"** — Instantly, 24/7.
- **"Will it sound like a robot?"** — No. The assistant uses your chosen tone and approved answers.
- **"What if it can't answer?"** — It captures the lead and escalates to a human.
- **"Does it book directly?"** — It sends your booking link or logs a booking request; the owner confirms.
- **"Can I see the leads?"** — Yes, in your dashboard, plus instant notifications.
- **"How long to launch?"** — Typically a few days once intake is complete.
- **"What if I want changes?"** — Revisions are included per your package (see [[Helios AI Revision & Support Process]]).

---

## Default lead capture fields

- Name
- Phone / WhatsApp number
- Email
- Service or enquiry type
- Preferred date / time (if booking)
- Channel / source (website, WhatsApp, form)
- Message / notes

---

## Owner notification format

```
🔔 New Lead — {Business Name}

Name: {name}
Contact: {phone / email}
Service: {service or enquiry}
Preferred time: {time or "not given"}
Channel: {website / WhatsApp / form}
Message: {short summary}

Captured: {timestamp}
```

Booking notifications use the same format with a "✅ Booking Request" header and the requested date/time.

---

## Human escalation rules

Escalate to a human when the assistant:
- Is asked something outside the approved FAQ set
- Hits a complaint, refund, or sensitive issue
- Is asked for medical, legal, or pricing it cannot confirm
- Detects an upset or frustrated customer
- Is explicitly asked to speak to a person

On escalation: capture the lead, tell the customer the team will follow up, and notify the owner immediately.

---

## What not to build unless paid for

- WhatsApp automation for Starter clients
- Booking integrations beyond the purchased package
- Custom dashboards or analytics on Starter / Booking OS
- Multi-location setups outside Ops Center
- Custom code or integrations not in any package
- Follow-up sequences not included in the package

Out-of-scope requests become upsells (see [[Helios AI Revision & Support Process]]), not free additions.

---

## Final delivery principle

Deliver a **working, simple, reliable system fast**, confirm it improves the core outcome, get client approval, launch, then optimize. Reliability and speed beat complexity every time.
