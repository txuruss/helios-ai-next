# Offers and Pricing — Helios AI Agency

See also: [[01-brand-identity]] | [[06-client-delivery-system]] | [[00-source-of-truth]]

> **Business direction:** [[Helios AI/Offers/Pricing]] holds the current published price points and CTAs. This note stays canonical for **offer strategy and delivery rationale**.

---

## The business model

```
Audit → Setup Project → Monthly Retainer
```

The **setup fee** covers building the system. The **monthly retainer** covers keeping it useful — each month we monitor the system, update FAQs, review the lead flow, improve responses, fix issues, and help capture more customer inquiries from the website, WhatsApp, or booking channels. The retainer is **active ongoing work**, never "maintenance only" and never a passive subscription.

Canonical package data in code: `lib/billing/packages.ts`. Proposal generator: `lib/sales/proposal.ts` + `docs/templates/proposal-template.md`.

---

## Current offer ladder

### Package 1 — Starter Lead Response System ($999 setup + $249/mo)

**Positioning:** A simple system to help local businesses stop missing customer inquiries.

**Best for:** Small salons, barbershops, solo service providers, and small local businesses.

**Setup includes (one-time build):**
- Website chat or simple lead form
- FAQ responses (trained on business info)
- Customer detail capture
- Owner email notification on new inquiries
- Basic dashboard

**Monthly retainer includes (light):**
- System monitoring
- 1 monthly update (FAQs, hours, services, or prices)
- Lead-flow check
- Basic support

---

### Package 2 — Booking OS ($2,500 setup + $499/mo)

**Positioning:** A booking and lead-response system that helps turn customer messages into appointments.

**Best for:** Spas, med spas, clinics, gyms, busy salons, and appointment-based businesses.

**Setup includes (one-time build):**
- Website chat
- WhatsApp assistant
- Booking request flow
- FAQ automation
- Lead dashboard
- Owner/team notifications
- Follow-up messages

**Monthly retainer includes (standard):**
- System monitoring and issue fixes
- Monthly optimization (FAQs, responses, booking flow)
- Lead-flow review
- Monthly reporting on inquiries and bookings
- Support

---

### Package 3 — Ops Center ($5,000 setup + $999/mo)

**Positioning:** A full lead management and automation system for businesses that need better control over inquiries, bookings, and follow-ups.

**Best for:** Larger service businesses, multi-service teams, and businesses that need stronger lead management.

**Setup includes (one-time build):**
- Full AI booking system
- Website chat and WhatsApp automation
- Lead dashboard
- Client intake flow
- Admin notifications
- Follow-up automation

**Monthly retainer includes (advanced):**
- System monitoring and issue fixes
- Monthly optimization across all channels
- Lead-flow review and response improvements
- Analytics and monthly reporting
- Priority support
- Monthly strategy review

---

## Pricing principles

- Price on **value delivered**, not hours spent
- Starter should be accessible but not cheap — this signals quality
- Booking OS should feel like an obvious upgrade from Starter
- Ops Center should feel like a business transformation, not a product
- Setup fees are acceptable and expected at this premium level
- Monthly retainer is the business model — not one-time builds
- Do not discount without a strategic reason

**Confirmed pricing (founder-set, 2026-06-24):**

| Package | Setup | Monthly |
|---------|-------|---------|
| Starter | $999 | $249/mo |
| Booking OS | $2,500 | $499/mo |
| Ops Center | $5,000 | $999/mo |

A discounted **first-client offer** of **$1,000–$1,500** (simple AI lead-capture / booking-assistant setup, manual delivery if needed) is used to land the first validation client. Full price points, inclusions, and CTAs: [[Pricing]].

---

## What makes an offer sellable

- It solves a pain the owner feels right now (missed leads, no-shows, manual follow-up)
- The outcome is measurable (more bookings, fewer missed calls, faster response)
- The delivery is clear (they know what they're getting)
- The onboarding is fast enough to feel like a win in week one
- There is a visible dashboard or tool they can show their team

---

## What should not be sold yet

- Custom AI agent builds without a repeatable delivery system
- Anything requiring significant custom code per client without templates
- Features still in planning phase (see [[10-feature-map]])
- Integrations not yet confirmed as working in production (see [[09-open-questions]])
- White-label reseller arrangements without a defined process

---

## Related notes

- [[06-client-delivery-system]] — How packages are delivered
- [[10-feature-map]] — Which features are ready vs planned
- [[09-open-questions]] — Pricing questions still open
