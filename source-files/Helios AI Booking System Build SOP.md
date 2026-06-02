# Helios AI Booking System Build SOP

How to build the booking flow for a client. Use alongside [[Helios AI System Setup Framework]].

---

## Purpose

Turn an inquiry into a booked appointment (or a clean booking request) without the owner lifting a finger. The booking flow guides the customer to a time, captures their details, and notifies the owner.

## When to use this SOP

- **Booking OS** and **Ops Center** clients (full booking flow).
- **Starter** clients only get a booking *link share* — no qualification or reschedule logic. If a Starter client wants the full flow, it's a Booking OS upsell.

## Required client information

- Services and durations
- Booking link (Cal.com or existing tool)
- Opening hours and availability
- Deposit policy
- Cancellation / rescheduling policy
- Walk-in policy
- Owner notification channel

## Booking flow objective

Get the customer to: pick a service → see availability → confirm a time → leave contact details → receive confirmation. Capture the lead at every step, even if they drop off.

## Standard booking conversation flow

1. Greet and identify intent ("Looking to book in?").
2. Ask which service.
3. Confirm duration and price if allowed.
4. Offer the booking link or available times.
5. Capture name + contact.
6. Confirm the booking or log the request.
7. Notify the owner.
8. Send confirmation message to the customer.

## Appointment request flow

When live calendar booking isn't connected:
- Collect service, preferred date/time, name, and contact.
- Tell the customer the team will confirm shortly.
- Send the owner a "Booking Request" notification.
- Owner confirms manually and the assistant follows up if needed.

## Booking link flow

- Share the booking link once the service is known.
- Keep it natural: "Here's the link to grab a time that suits you: {link}".
- Still capture the lead's name/contact before sending, so a drop-off is recoverable.

## Walk-in handling

- If the client accepts walk-ins, state hours and that walk-ins are welcome.
- If walk-ins are limited or not accepted, steer to booking: "We're appointment-only — here's the link to secure a spot."

## Deposit handling

- If a deposit is required, state the amount and when it's taken before confirming.
- Do not invent deposit amounts — use the client's policy only.
- If the client takes deposits via the booking tool, point the customer there.

## Rescheduling handling

- Ask for the existing booking name/time.
- Share the reschedule link or capture the new preferred time.
- Notify the owner of the change.

## Cancellation handling

- Confirm the customer wants to cancel.
- State the cancellation policy / notice period.
- Capture the cancellation and notify the owner.
- Offer to rebook: "Want me to help you find another time?"

## Same-day booking handling

- Check the same-day policy.
- If allowed, share earliest availability.
- If not, offer the next available slot and capture the lead.

## Fully booked response

- Be honest: "We're fully booked for {day}."
- Offer the next available time or a waitlist capture.
- Always capture the lead so the owner can follow up if a slot opens.

## Owner notification trigger

Fire a notification when:
- A booking is confirmed
- A booking request is submitted
- A reschedule or cancellation happens

Use the booking notification format from [[Helios AI Client Delivery Brain]].

## Booking test checklist

- [ ] Customer can pick a service
- [ ] Booking link opens correctly
- [ ] Booking request captures name + contact
- [ ] Deposit policy stated correctly (if applicable)
- [ ] Reschedule path works
- [ ] Cancellation path works
- [ ] Fully-booked response works
- [ ] Owner notification fires on booking
- [ ] Confirmation message reaches the customer
- [ ] Works on mobile

## Example booking conversations

**Booking link share**
> Customer: Do you have space for a fade tomorrow?
> Assistant: We do! A skin fade is $25 and takes about 30 mins. Can I grab your name? Then here's the link to pick a time: {link}

**Booking request (manual confirm)**
> Customer: Can I get a facial Saturday afternoon?
> Assistant: Of course — a classic facial is 60 mins. What's your name and best number? I'll get Saturday afternoon confirmed and our team will lock it in shortly.

**Fully booked**
> Customer: Anything today?
> Assistant: We're fully booked today, but I can get you the first slot tomorrow at 10am, or add you to the waitlist if a spot opens. What's your name and number?

## Common mistakes to avoid

- Sending a booking link without capturing the lead first.
- Inventing prices, durations, or deposit amounts.
- Promising same-day or walk-in when policy says otherwise.
- Not notifying the owner on a request.
- Letting the conversation dead-end with no booking and no captured lead.
- Overcomplicating: if a simple link share books the client, use it.
