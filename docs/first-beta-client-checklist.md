# First Beta Client Checklist — Helios AI

> Use this checklist when onboarding your first real local service business.

---

## Before the Sales Call

- [ ] Choose the niche (barbershop, salon, spa, clinic, cleaning, auto repair, tutor)
- [ ] Load the matching niche template in /dashboard/templates
- [ ] Run a Deployment Score audit in /dashboard/audits
- [ ] Prepare the pricing slide: Starter ($999+$249/mo), Booking OS ($2,500+$499/mo), Ops Center ($5,000+$999/mo)
- [ ] Research the business: Google reviews, Instagram, website, current booking method
- [ ] Prepare 2–3 pain point questions specific to their niche

---

## During the Sales Call

### Questions to ask:
- "How do you currently handle customer messages and DMs?"
- "Do you ever miss calls or texts when you're with a client?"
- "How are bookings currently handled — phone, DM, walk-in?"
- "What happens after hours when customers try to reach you?"
- "Do you have a website? Does it have a booking or contact form?"
- "Do you use WhatsApp for customer communication?"

### Show the demo:
1. Run the 2-minute demo at /demo
2. Show the widget with their niche (barbershop, salon, etc.)
3. Show Mission Control — leads, bookings, AI status
4. Show the Inbox — human handoff feature
5. Show the booking confirmation flow
6. Show the template for their niche
7. Show the Deployment Score audit

### Close:
- Explain the setup process: 2–3 days for Starter, 3–5 days for Booking OS
- Explain monthly includes hosting, AI, monitoring, and support
- Ask: "Does this solve the problem you're facing?"
- Ask: "What would you need to see before moving forward?"
- Propose next step: send onboarding intake link (/dashboard/onboarding)

---

## After the Sales Call

- [ ] Send a recap email within 24 hours (what you discussed, what Helios does, next steps)
- [ ] Share the intake link: /dashboard/onboarding
- [ ] Confirm which package they are considering
- [ ] Book a follow-up call if needed

---

## Client Setup (once signed)

### Day 1 — Intake and profile
- [ ] Complete the onboarding intake at /dashboard/onboarding
- [ ] Create business profile at /dashboard/business
  - Business name, type, hours, city, description
  - Owner notification email (critical)
- [ ] Apply the niche template at /dashboard/templates
  - Choose: barbershop, hair salon, beauty spa, clinic, cleaning, auto repair, or tutor
  - Apply mode: Append

### Day 1–2 — Services and FAQs
- [ ] Review and edit services at /dashboard/services
  - Verify names, pricing, and durations
  - Add any missing services
- [ ] Review and edit FAQs
  - Top 5–10 questions customers ask most
  - Include hours, pricing, booking, cancellation

### Day 2 — Booking and widget
- [ ] Connect Cal.com at /dashboard/calcom (if available)
  - Map services to Cal.com event types
- [ ] Configure the website widget at /dashboard/widget
  - Set business name, intro message, primary color
  - Copy the embed code for their website
- [ ] Test the widget at /demo/widget or on their website

### Day 3 — Channels and notifications
- [ ] Connect WhatsApp Business at /dashboard/whatsapp (if on Booking OS or Ops Center)
  - Add Meta phone number ID and access token
  - Verify with WHATSAPP_VERIFY_TOKEN
- [ ] Test owner notification email
  - Send a test chat message → confirm email arrives
- [ ] Test booking request → confirm it appears in /dashboard/bookings

### Day 3–4 — QA and launch
- [ ] Complete the Demo QA checklist at /dashboard/setup (17 items)
- [ ] Run the Deployment Score audit at /dashboard/audits
  - Target: 70+ score before launch
- [ ] Complete the delivery pipeline at /dashboard/delivery
  - Work through all 19 tasks in order
- [ ] Approve launch in /dashboard/setup
- [ ] Mark launch approved in the delivery pipeline

### Handoff
- [ ] Share the dashboard URL with the business owner
- [ ] Share login credentials or invite them as a team member
- [ ] Walk them through Mission Control (5 minutes)
- [ ] Show them how to pause AI in the inbox
- [ ] Show them how to confirm/reject bookings
- [ ] Schedule a 30-day check-in call

---

## Success Metrics (First 30 Days)

Track in Mission Control:
- New leads captured (target: 10+)
- Booking requests received
- AI conversations handled
- Owner notifications sent
- Handoff requests (shows customers want human help)
- Deployment Score (target: 80+)

---

## If Something Breaks

1. Check /dashboard/ops → System Health → Production Launch Checklist
2. Check /dashboard/ops → Webhook Observability
3. Check /dashboard/ops → Ops Center for active alerts
4. Review /dashboard/inbox for missed conversations
5. Contact Anthropic status page if AI is failing
6. Contact Resend status page if emails are failing
7. Check Supabase dashboard for DB issues
