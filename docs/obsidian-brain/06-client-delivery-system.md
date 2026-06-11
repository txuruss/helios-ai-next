# Client Delivery System — Helios AI Agency

See also: [[02-offers-and-pricing]] | [[04-agent-workflows]] | [[03-mission-control]]

---

## Core delivery lifecycle (setup fee + monthly retainer)

Every client follows the same commercial flow:

```
Audit → Proposal → Setup → Launch → Monthly Retainer → Monthly Optimization Report
```

- **Audit** — diagnose how inquiries and bookings are handled today (careful language: "may be losing inquiries", never unverified claims).
- **Proposal** — Sales Offer Builder output using `docs/templates/proposal-template.md`: recommended package, setup fee, monthly retainer, setup vs monthly deliverables, next step.
- **Setup** — the one-time build, covered by the setup fee (Phases 6–11 below).
- **Launch** — QA + handoff (Phase 12).
- **Monthly Retainer** — active ongoing work, never passive: monitoring, FAQ updates, lead-flow review, response improvements, support (see "Monthly retainer cycle" below).
- **Monthly Optimization Report** — `docs/templates/monthly-optimization-report.md`, delivered every month; the `last_report_date` / `next_review_date` fields in admin_clients track the cycle.

---

## Delivery phases

### Phase 1 — Lead Captured
- Lead submits via website chat, form, or referral
- Lead record created in Supabase
- Owner/team notified
- Lead Capture Agent logs the event

### Phase 2 — Business Qualified
- Client Qualifier Agent runs assessment
- Lead reviewed by sales team
- Qualification result recorded (pass/fail/pending)
- Recommended package noted

### Phase 3 — Audit Created
- Business audit generated (manual or AI-assisted)
- Audit covers: current tools, missed leads, booking process, response time, biggest pain points
- Audit stored and linked to lead record

### Phase 4 — Offer Generated
- Sales Offer Builder Agent drafts a tailored proposal
- Proposal reviewed and approved by team member
- Proposal sent to lead via email or WhatsApp

### Phase 5 — Discovery Call Booked
- Lead books a discovery call via Cal.com link
- Booking confirmation sent automatically
- Pre-call notes prepared

### Phase 6 — Client Onboarded
- Contract or agreement signed
- Client record created (distinct from lead record)
- Payment set up via Stripe
- Welcome sequence triggered

### Phase 7 — Knowledge Collected
- Business info form completed by client
- Collected: service list, FAQs, tone of voice, key contact info, booking rules, business hours
- All information stored in client record in Supabase

### Phase 8 — AI Assistant Configured
- AI chat widget configured with client's knowledge base
- Tone, greeting, and fallback rules set
- Widget embed code generated for client website

### Phase 9 — Booking Flow Configured
- Cal.com booking flow set up for client's services
- Availability, buffer times, and confirmation messages configured
- Booking link embedded in AI widget or sent directly

### Phase 10 — Notifications Configured
- Owner notification rules set (email and/or WhatsApp)
- Notification triggers: new lead, new booking, missed follow-up
- Test notifications sent and confirmed

### Phase 11 — QA Completed
- Full QA checklist completed (see below)
- All issues resolved
- Delivery QA Agent report reviewed by team
- Launch readiness confirmed

### Phase 12 — Client Handoff
- Client receives handoff pack: dashboard login, embed codes, booking links, how-to guide
- Onboarding call or walkthrough completed
- Client confirms all systems are working
- Handoff signed off by team member

### Phase 13 — Monthly Retainer (ongoing)
- Monthly review call or async check-in
- Performance metrics reviewed (leads captured, bookings made, response rate)
- Adjustments made to AI widget, booking flow, or notifications
- Optimization notes logged in client workspace
- Monthly optimization report delivered; `last_report_date` and `next_review_date` updated on the client record

---

## Monthly retainer cycle

The retainer is the business model — repeat this loop every month per client, using the templates in `docs/templates/`:

1. **Monthly system check** — `monthly-system-check.md`: verify chat, booking flow, notifications, and dashboard all work.
2. **FAQ update checklist** — `faq-update-checklist.md`: confirm services, prices, hours, and FAQ answers are current.
3. **Lead-flow review** — `lead-flow-review.md`: review inquiries, response quality, and drop-off points.
4. **Monthly optimization report** — `monthly-optimization-report.md`: send to the client; update `last_report_date` and set the next `next_review_date`.
5. **Retainer check-in** — `retainer-renewal-checkin.md`: short message confirming value delivered and what's next.

Tracking lives in Mission Control (Retainer Health panel) and the client drawer (Monthly Retainer section): retainer status (Active / Paused / Cancelled / Needs Review), next review date, last report date, open support items.

---

## Required client information

Before delivery can begin, collect:

- [ ] Business name and trading name
- [ ] Industry / niche
- [ ] Location(s)
- [ ] Services offered (full list with descriptions)
- [ ] Business hours
- [ ] Booking availability and rules (if applicable)
- [ ] Primary contact (name, email, phone)
- [ ] Owner notification preferences (email / WhatsApp / both)
- [ ] Brand tone preference (formal / friendly / professional / casual)
- [ ] Top 10 FAQs customers ask
- [ ] What the AI should NOT answer (escalation triggers)
- [ ] Website URL (for widget deployment)
- [ ] Existing tools in use (CRM, booking system, etc.)
- [ ] Stripe billing email

---

## Delivery checklist

- [ ] Client record created in Supabase with all required fields
- [ ] Package confirmed and Stripe subscription active
- [ ] Business knowledge base uploaded and reviewed
- [ ] AI widget configured (greeting, tone, FAQ responses)
- [ ] Widget embed code generated and tested
- [ ] Booking flow created (if applicable)
- [ ] Cal.com booking link tested end-to-end
- [ ] Owner notification tested (email + WhatsApp if applicable)
- [ ] Dashboard access granted to client
- [ ] All test scenarios passed

---

## QA checklist

- [ ] AI chat widget loads correctly on a test page
- [ ] Widget answers at least 5 common FAQs correctly
- [ ] Lead capture form submits and creates a lead record
- [ ] Owner notification fires on new lead
- [ ] Booking link opens correctly and accepts a test booking
- [ ] Booking confirmation email is received
- [ ] Owner notification fires on new booking
- [ ] Dashboard shows lead and booking data correctly
- [ ] WhatsApp message received (if configured)
- [ ] No errors in Sentry after test runs
- [ ] Widget does not expose sensitive data in responses

---

## Launch checklist

- [ ] All QA items passed
- [ ] Client has confirmed all systems work
- [ ] Embed code provided for client's website
- [ ] Client has access to dashboard
- [ ] Handoff document delivered
- [ ] Monthly optimization call scheduled
- [ ] Client record status set to "Active" in Supabase
- [ ] Delivery team notified of successful launch

---

## Related notes

- [[04-agent-workflows]] — Agents used in this delivery system
- [[03-mission-control]] — Where delivery status is tracked
- [[02-offers-and-pricing]] — What each package includes
- [[09-open-questions]] — Integrations that need verification before delivery
