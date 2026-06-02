# Helios AI WhatsApp Assistant SOP

How to set up a WhatsApp assistant for **Booking OS** and **Ops Center** clients. Not included in Starter.

---

## Purpose

Reply to WhatsApp inquiries instantly, answer FAQs, capture leads, and route to booking — the channel where most local-service customers actually message.

## When WhatsApp should be included

- **Booking OS:** WhatsApp assistant *or* email follow-up (client chooses).
- **Ops Center:** WhatsApp always included.
- **Starter:** never — it's an upsell to Booking OS.

## Required access

- WhatsApp Business number
- Meta WhatsApp Business API access / connection
- Confirmation the number isn't tied to a personal app that will conflict
- Owner notification channel

## WhatsApp assistant role

Greet, answer approved FAQs, capture lead details, share the booking link or log a booking request, escalate to a human when needed, and keep replies short and mobile-friendly.

## Greeting flow

- First message: warm, branded, quick.
- Example: "Hi 👋 Thanks for messaging {Business}! How can I help — booking, prices, or a question?"
- Returning contacts: skip the long intro.

## FAQ flow

- Answer only with approved answers from [[Helios AI Client FAQ Builder]].
- Keep answers to 1–3 short lines.
- If unknown → capture details + escalate.

## Booking flow

- Follow [[Helios AI Booking System Build SOP]].
- Share the booking link or collect a booking request.
- Always capture name + number (the number is already known on WhatsApp, so confirm name + service).

## Lead capture flow

- Capture: name, service/enquiry, preferred time, message.
- The WhatsApp number is the contact — confirm it's the best number.
- Log the lead to the dashboard and notify the owner.

## Human handoff flow

- Triggers: complaints, refunds, complex/custom requests, upset customer, explicit "talk to a person."
- Message: "I'll pass this to the team and they'll reply here shortly." Then notify the owner immediately.

## Owner notification flow

- Notify on new lead and booking request.
- Use the standard notification format from [[Helios AI Client Delivery Brain]].

## Follow-up flow

- If a customer goes quiet mid-booking, one gentle follow-up: "Still keen to book? Happy to hold a time for you."
- Respect the 24-hour window (below). Don't spam.

## 24-hour response window awareness

- WhatsApp Business API allows free-form replies only within **24 hours** of the customer's last message.
- Outside 24 hours, only approved message templates can be sent.
- Design flows to resolve within the window; if follow-up is needed later, use an approved template.

## WhatsApp tone rules

- Short, friendly, human.
- Light, tasteful emoji use if it matches the client's tone.
- Mobile-first: no long paragraphs.
- Match the client's chosen tone from intake.

## Example WhatsApp conversations

**Greeting + FAQ + booking**
> Customer: Hi, how much for a fade?
> Assistant: Hi 👋 A skin fade is $25 (about 30 mins). Want me to grab you a time? What's your name?
> Customer: John
> Assistant: Thanks John! Here's the link to pick a slot: {link} — or tell me a day and I'll sort it.

**Booking request (manual confirm)**
> Customer: Can I get in Saturday afternoon?
> Assistant: Of course — what service are you after, and what's your name? I'll get Saturday afternoon confirmed and the team will lock it in shortly.
> Customer: Beard trim, name's Sam.
> Assistant: Got it Sam ✅ Booking request for a beard trim Saturday afternoon is in — the team will confirm your time here shortly.

**Human handoff**
> Customer: I was charged twice for my last visit.
> Assistant: Sorry about that — I'll pass this straight to the team and they'll reply here shortly to sort it out. Can I take your name so they have it ready?

**Outside the 24-hour window (approved template)**
> Assistant (template): Hi {name}, it's {Business} 👋 You were asking about booking in — would you still like a time? Reply here and we'll sort it.

## Test scenarios

- [ ] New customer greeting
- [ ] FAQ question (price, hours, location)
- [ ] Booking request end-to-end
- [ ] Booking link share
- [ ] Lead capture + owner notification
- [ ] Human handoff trigger
- [ ] Unknown question → capture + escalate
- [ ] Reply formatting on a phone

## Launch checklist

- [ ] WhatsApp number connected and verified
- [ ] Greeting live
- [ ] FAQs loaded and approved
- [ ] Booking flow working
- [ ] Lead capture + notifications working
- [ ] Handoff path working
- [ ] 24-hour window handling confirmed
- [ ] Client approved

## Common mistakes to avoid

- Sending long, formal paragraphs.
- Replying outside the 24-hour window without an approved template.
- Inventing answers instead of escalating.
- Forgetting to confirm the best contact name.
- Not notifying the owner on handoff.
- Over-automating follow-ups (spam).
