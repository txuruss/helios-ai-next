# Helios AI System Setup Framework

The full setup logic for every client build. Follow the steps in order. Do not skip testing or approval.

---

## Step 1: Confirm the package

- Confirm Starter, Booking OS, or Ops Center.
- Re-read the package scope in [[Helios AI Client Delivery Brain]].
- Confirm what is in scope and what is not. Anything extra is an upsell, not a freebie.

## Step 2: Define the system goal

- State the one core outcome for this client (e.g. "reply to every after-hours inquiry and capture the lead").
- Write it in one sentence. Every flow must serve it.

## Step 3: Define the channels

- **Starter:** website chat only.
- **Booking OS:** website chat + WhatsApp (or email follow-up).
- **Ops Center:** website chat + WhatsApp + automation.
- Confirm the client has each channel ready (website access, WhatsApp Business number).

## Step 4: Define the AI assistant role

- Set the assistant's job: greet, answer FAQs, capture leads, route to booking, escalate when needed.
- Set tone from intake.
- Set the greeting and fallback message.
- Define what it must NOT do (no invented prices, no promises outside services, escalate sensitive topics).

## Step 5: Build the lead capture flow

- Capture: name, contact, service/enquiry, preferred time, source, message.
- Ask for contact details early but naturally.
- Always capture the lead even if the customer doesn't book.
- Store leads in the dashboard and trigger an owner notification.

## Step 6: Build the FAQ flow

- Load approved answers from [[Helios AI Client FAQ Builder]].
- Cover services, pricing, booking, location, hours, policies, payment.
- The assistant only uses approved answers. If unknown → capture lead + escalate.

## Step 7: Build the booking flow

- Follow [[Helios AI Booking System Build SOP]].
- Send the booking link or log a booking request.
- Handle reschedules, cancellations, deposits, walk-ins, and fully-booked responses per the SOP.
- Confirm the booking notification fires to the owner.

## Step 8: Build the notification flow

- Set owner notification channel (email / WhatsApp / both).
- Use the standard notification format from the Delivery Brain.
- Triggers: new lead, booking request.
- Send a test notification and confirm receipt.

## Step 9: Build the dashboard

- Follow [[Helios AI Client Dashboard Setup]].
- Show leads, status, contact, source, and notes.
- Grant the client login access.

## Step 10: Test the system

- Run all scenarios in the relevant SOPs and [[Helios AI Launch Readiness Checklist]].
- Test FAQ answers, lead capture, booking, notifications, dashboard, mobile view.
- Fix every issue before approval.

## Step 11: Get client approval

- Send FAQ approval, booking flow approval, and chat test requests (templates in [[Helios AI Delivery Templates]]).
- Get written sign-off from the approval contact before launch.

## Step 12: Launch

- Confirm all launch readiness items pass.
- Deploy the widget / WhatsApp assistant live.
- Send the Launch completed message.

## Step 13: Monitor after launch

- Watch the first days of real conversations.
- Fix any wrong answers fast.
- Log issues and optimization notes.
- Schedule the monthly optimization review (Booking OS / Ops Center).

---

## Build sequence at a glance

Typical order and effort once intake is complete (aim: a few working days, not weeks):

| Phase | Steps | Focus |
|-------|-------|-------|
| Setup | 1–4 | Confirm scope, goal, channels, assistant role |
| Build | 5–9 | Lead capture → FAQ → booking → notifications → dashboard |
| Verify | 10 | Test every flow end-to-end |
| Sign-off | 11 | Client approves FAQs, booking, chat |
| Go-live | 12–13 | Launch + monitor first days |

Build the assistant + FAQ + lead capture first (that alone delivers the core outcome), then layer booking and notifications, then the dashboard.

## Minimum viable system

Every client launches with at least:
- Website AI chat answering FAQs
- Lead capture with owner notification
- A clear path to booking (link or request)
- A dashboard the client can log into

If these four work reliably, the system is launch-ready.

---

## Upgrade paths

- **Starter → Booking OS:** add WhatsApp, booking flow, qualification, monthly review.
- **Booking OS → Ops Center:** add advanced dashboard, follow-up automation, analytics, priority support.
- Track upgrade signals (volume, multi-location, follow-up needs) and use the upsell templates.

---

## What to avoid

- Building features outside the paid package.
- Adding complexity that delays launch.
- Letting the assistant guess prices or details.
- Launching without client approval.
- Over-customizing instead of using templates.

---

## Delivery quality standard

- The assistant answers correctly using only approved info.
- Leads are always captured and the owner is always notified.
- Booking path works end-to-end.
- Works on mobile.
- Client has approved and can access their dashboard.
- A working simple system beats a complicated unfinished one.
