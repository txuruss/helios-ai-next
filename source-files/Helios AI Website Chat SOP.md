# Helios AI Website Chat SOP

How to set up the website AI chat system. Included in **every** package (Starter, Booking OS, Ops Center).

---

## Purpose

Catch website visitors the moment they show interest, answer their questions, capture their details, and push them toward booking — 24/7, even when the business is closed.

## Website chat goal

Convert anonymous website traffic into captured, contactable leads and booked appointments without the owner needing to be online.

## Required information

- Website URL and platform (for embed)
- Approved FAQs (see [[Helios AI Client FAQ Builder]])
- Services, prices, hours, location
- Booking link
- Assistant tone and greeting
- Owner notification channel

## Chat assistant role

Greet visitors, answer approved FAQs, capture leads, share the booking link or log a booking request, and escalate to a human when needed.

## Website greeting flow

- Auto-greeting on open: short and inviting.
- Example: "Hi! 👋 Welcome to {Business}. Want to book in or have a quick question?"
- Offer quick options if supported (Book / Prices / Hours / Speak to team).

## FAQ answering rules

- Use only approved answers.
- Keep replies concise and clear.
- If a question is outside the approved set → capture the lead + escalate.
- Never invent prices, availability, or policies.

## Lead capture rules

- Capture name, contact (email or phone), and enquiry type.
- Ask for contact details early but naturally.
- Always capture the lead even if they don't book.
- Store the lead and fire an owner notification.

## Booking link rules

- Share the booking link once the visitor shows booking intent.
- Capture name + contact before or alongside the link.
- For Booking OS / Ops Center, follow the full flow in [[Helios AI Booking System Build SOP]].

## Human handoff rules

- Triggers: complaints, refunds, complex requests, upset visitor, "speak to a person," or anything outside approved FAQs.
- Tell the visitor the team will follow up, capture their details, and notify the owner.

## Owner notification rules

- Notify on new lead and booking request.
- Use the standard notification format from [[Helios AI Client Delivery Brain]].

## Widget placement checklist

- [ ] Bottom-right corner (default), not blocking key content
- [ ] Visible on all key pages (home, services, contact)
- [ ] Branded color matches the site
- [ ] Greeting shows without being intrusive
- [ ] Loads fast, no layout shift

## Mobile testing checklist

- [ ] Widget button visible and tappable on mobile
- [ ] Chat window fits the screen
- [ ] Keyboard doesn't cover the input
- [ ] Booking link opens correctly on mobile
- [ ] Text is readable without zoom

## Website embed testing

- [ ] Embed code installed on the live site (or staging)
- [ ] Widget loads on every required page
- [ ] No JavaScript console errors
- [ ] Lead capture writes to the dashboard
- [ ] Notification fires on a test lead

## Example website chat conversations

**FAQ + booking**
> Visitor: How much is a gel manicure?
> Assistant: A gel manicure is $35 and takes about 45 mins 💅 Want me to grab you a time? Here's the link: {link} — what's your name?

**Lead capture (no booking)**
> Visitor: Do you do bridal packages?
> Assistant: We do! I'll have the team send you the bridal package details. What's your name and best email?

**Escalation**
> Visitor: I had a bad experience last week.
> Assistant: I'm sorry to hear that — I'll pass this straight to the team so they can help. What's the best way to reach you?

## Common mistakes to avoid

- Widget hidden or blocking content on mobile.
- Auto-greeting too aggressive or pops repeatedly.
- Inventing answers instead of escalating.
- Sharing a booking link without capturing the lead.
- Not testing on the live site before launch.
- Overcomplicating the flow when a simple capture + link works.
