# Client Delivery System — Helios AI Agency

See also: [[02-offers-and-pricing]] | [[04-agent-workflows]] | [[03-mission-control]]

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

### Phase 13 — Monthly Optimization
- Monthly review call or async check-in
- Performance metrics reviewed (leads captured, bookings made, response rate)
- Adjustments made to AI widget, booking flow, or notifications
- Optimization notes logged in client workspace

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
