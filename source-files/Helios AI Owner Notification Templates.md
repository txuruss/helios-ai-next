# Helios AI Owner Notification Templates

Source file for the Helios AI Client Delivery & Systems project. Defines how Helios AI structures every notification sent to a business owner or their team when a new lead, booking request, missed inquiry, urgent inquiry, or follow-up action is created.

---

## 1. Purpose

Owner notifications exist to do one thing: get the right person to take the right next action quickly. A notification that does not lead to an action is noise.

This file is the single source of truth for:

- When a notification should and should not fire
- What fields every notification carries
- The exact reusable template for each notification type
- Priority levels and delivery channels
- Writing rules that keep owners informed without overwhelming them

Companion file: `Helios AI Lead Capture & Dashboard Schema.md` — the field names, lead statuses, and inquiry sources used here are defined there. The two files must stay consistent.

**Core principle: owners should never be overwhelmed.** Every notification must be short, clear, and focused on the next action. If a business owner starts ignoring notifications, the system has failed — fewer, better notifications always beat more notifications.

---

## 2. When Owner Notifications Should Trigger

Send a notification when:

| Event | Notification Type | Default Priority |
|---|---|---|
| A new lead is captured (any source) | New Lead | Normal |
| A customer requests an appointment | New Appointment Request | High |
| A customer message signals urgency (pain, same-day need, complaint) | Urgent Inquiry | Urgent |
| An inquiry got no reply within the agreed window | Missed Inquiry Follow-Up | High |
| A new lead arrives via WhatsApp | WhatsApp Lead | Normal |
| A new lead arrives via website chat | Website Chat Lead | Normal |
| A lead's status changes in a way the owner asked to know about | Lead Status Update | Low |
| End of day (if there was any activity) | Daily Lead Summary | Low |
| End of week | Weekly Performance Summary | Low |

Do **not** send a notification when:

- The event duplicates one already sent (one notification per event, ever)
- A returning customer continues an existing conversation (update the lead record instead)
- The chat visitor never shared any contact information and asked only a general FAQ (log it; do not notify)
- A status changes for routine internal reasons (e.g. Archived)
- The same customer triggers multiple events within a few minutes — bundle into one notification

Quiet hours: by default, only **Urgent** notifications are delivered between 21:00 and 08:00 local business time. Everything else queues into the next Daily Lead Summary or sends at 08:00. Confirm quiet hours with each client during onboarding.

---

## 3. Standard Notification Fields

Every notification is assembled from this field set. Required fields must always be present; optional fields are included only when known — **never invent or guess a value**. Omit the whole line when the value is unknown.

| Field | Placeholder | Required | Notes |
|---|---|---|---|
| Business Name | `{{Business Name}}` | Yes | The client business receiving the notification |
| Customer Name | `{{Customer Name}}` | Yes | Use `Unknown` if not captured |
| Phone Number | `{{Phone Number}}` | At least one contact method | Formatted with country code where known |
| Email | `{{Email}}` | At least one contact method | — |
| Service Requested | `{{Service Requested}}` | Optional | Exactly as the customer stated it |
| Preferred Date | `{{Preferred Date}}` | Optional | As stated; do not normalize away ambiguity ("Friday" stays "Friday") |
| Preferred Time | `{{Preferred Time}}` | Optional | — |
| Inquiry Source | `{{Inquiry Source}}` | Yes | One of the sources in the schema file (Website Chat, WhatsApp, etc.) |
| Customer Message | `{{Customer Message}}` | Optional | Verbatim quote, trimmed to ~200 characters |
| Conversation Summary | `{{Conversation Summary}}` | Optional | 1–2 sentences, facts only |
| Recommended Next Action | `{{Recommended Next Action}}` | Yes | One specific action, e.g. "Call back to confirm Friday 2pm" |
| Lead Status | `{{Lead Status}}` | Optional | From the schema status list |
| Assigned Team Member | `{{Assigned Team Member}}` | Optional | Only when the client has a team |
| Created At | `{{Created At}}` | Yes | Date + time, business local timezone |
| Dashboard Link | `{{Dashboard Link}}` | Recommended | Deep link to the lead record |

Placeholder convention: `{{Double Curly Braces}}`. When filling a template, replace every placeholder with real captured data, and delete any optional line whose value is unknown.

---

## 4. New Lead Notification Template

Use for any new lead with contact details that is not an appointment request and not urgent.

```
Subject: New lead — {{Customer Name}} ({{Inquiry Source}})

New lead for {{Business Name}}.

Name: {{Customer Name}}
Phone: {{Phone Number}}
Email: {{Email}}
Interested in: {{Service Requested}}
Source: {{Inquiry Source}}
Message: "{{Customer Message}}"

Next action: {{Recommended Next Action}}

Received {{Created At}} · View lead: {{Dashboard Link}}
```

---

## 5. New Appointment Request Notification Template

Use when a customer asks for an appointment. Helios AI installs **appointment-request flows first** (the customer states what they want, the business confirms) — so this notification asks the owner to confirm, not informs them of a finished booking.

```
Subject: Appointment request — {{Customer Name}} — {{Preferred Date}} {{Preferred Time}}

{{Customer Name}} requested an appointment with {{Business Name}}.

Service: {{Service Requested}}
Preferred: {{Preferred Date}} at {{Preferred Time}}
Phone: {{Phone Number}}
Email: {{Email}}
Source: {{Inquiry Source}}
Notes: "{{Customer Message}}"

Next action: Confirm or propose a new time — reply to the customer directly, then mark the lead Appointment Confirmed.

Received {{Created At}} · View lead: {{Dashboard Link}}
```

---

## 6. Urgent Inquiry Notification Template

Use when the customer signals urgency: same-day need, pain or discomfort, a complaint, a cancellation that frees revenue-critical time, or explicit words like "urgent" / "today" / "as soon as possible". Always delivered immediately, including during quiet hours.

```
Subject: URGENT — {{Customer Name}} needs a response now

Urgent inquiry for {{Business Name}}.

Name: {{Customer Name}}
Phone: {{Phone Number}}
Why urgent: {{Conversation Summary}}
Message: "{{Customer Message}}"
Source: {{Inquiry Source}}

Next action: {{Recommended Next Action}}
Respond as soon as possible — urgent inquiries cool off fast.

Received {{Created At}} · View lead: {{Dashboard Link}}
```

---

## 7. Missed Inquiry Follow-Up Notification Template

Use when an inquiry has had no business response within the agreed response window (default: 4 business hours — confirm per client). This is a nudge about an existing lead, not a new lead.

```
Subject: Follow up needed — {{Customer Name}} has not been answered

{{Customer Name}} contacted {{Business Name}} and has not received a reply yet.

Waiting since: {{Created At}}
Interested in: {{Service Requested}}
Phone: {{Phone Number}}
Email: {{Email}}
Source: {{Inquiry Source}}
Last message: "{{Customer Message}}"

Next action: {{Recommended Next Action}}

View lead: {{Dashboard Link}}
```

---

## 8. WhatsApp Lead Notification Template

Use when a new lead arrives through the WhatsApp assistant. Keep it tight — owners often read this on their phone between customers.

```
Subject: New WhatsApp lead — {{Customer Name}}

WhatsApp lead for {{Business Name}}.

Name: {{Customer Name}}
WhatsApp: {{Phone Number}}
Asked about: {{Service Requested}}
Summary: {{Conversation Summary}}

Next action: {{Recommended Next Action}}

Received {{Created At}} · View lead: {{Dashboard Link}}
```

---

## 9. Website Chat Lead Notification Template

Use when the website chat assistant captures contact details.

```
Subject: New website chat lead — {{Customer Name}}

Website chat lead for {{Business Name}}.

Name: {{Customer Name}}
Phone: {{Phone Number}}
Email: {{Email}}
Asked about: {{Service Requested}}
Summary: {{Conversation Summary}}

Next action: {{Recommended Next Action}}

Received {{Created At}} · View lead: {{Dashboard Link}}
```

---

## 10. Lead Status Update Notification Template

Use only for status changes the owner opted into (recommended default: Appointment Confirmed and Closed Won only). Most status changes belong in the dashboard, not the inbox.

```
Subject: Lead update — {{Customer Name}} is now {{Lead Status}}

{{Customer Name}} ({{Business Name}}) moved to: {{Lead Status}}

Changed by: {{Assigned Team Member}}
Context: {{Conversation Summary}}

Next action: {{Recommended Next Action}}

Updated {{Created At}} · View lead: {{Dashboard Link}}
```

---

## 11. Daily Lead Summary Notification Template

Send once per day at an agreed time (default 18:00 local) — and only if there was activity. Report **only tracked numbers**; never estimate.

```
Subject: {{Business Name}} — daily lead summary for {{Created At}}

Today at a glance:

- New leads: {{New Lead Count}}
- Appointment requests: {{Appointment Request Count}}
- Awaiting your reply: {{Awaiting Reply Count}}
- Follow-ups due tomorrow: {{Follow-Up Due Count}}

Needs attention first:
- {{Customer Name}} — {{Service Requested}} — {{Recommended Next Action}}
- {{Customer Name}} — {{Service Requested}} — {{Recommended Next Action}}

Open the dashboard: {{Dashboard Link}}
```

If a count is zero, keep the line — zeros are information. If nothing happened at all, skip the email entirely.

---

## 12. Weekly Performance Summary Notification Template

Send once per week (default Monday 09:00 local, covering the previous week). Facts only — if a metric is not tracked yet, say what should be connected, never guess.

```
Subject: {{Business Name}} — weekly summary, {{Week Start Date}} to {{Week End Date}}

This week:

- Total inquiries: {{Total Inquiry Count}}
- Appointment requests: {{Appointment Request Count}}
- Appointments confirmed: {{Appointment Confirmed Count}}
- Closed won: {{Closed Won Count}}
- No response / lost: {{No Response Count}}

By source:
- Website chat: {{Website Chat Count}}
- WhatsApp: {{WhatsApp Count}}
- Other sources: {{Other Source Count}}

Worth noting: {{Conversation Summary}}

Suggested focus for next week: {{Recommended Next Action}}

Full details: {{Dashboard Link}}
```

---

## 13. Notification Priority Levels

| Priority | Meaning | Delivery | Examples |
|---|---|---|---|
| **Urgent** | Revenue or reputation at risk right now | Immediately, all agreed channels, ignores quiet hours | Same-day request, complaint, customer in pain |
| **High** | Action needed today | Immediately during business hours; 08:00 if queued overnight | Appointment request, missed-inquiry nudge |
| **Normal** | Action needed within the response window | Immediately during business hours, batched if several arrive together | New lead, WhatsApp lead, chat lead |
| **Low** | Informational | Digest only (daily/weekly), or dashboard only | Status updates, summaries |

Rules:

- One step down is always allowed (a client may ask for appointment requests at Normal). One step **up** requires a reason logged in onboarding notes.
- If more than ~5 Normal notifications fire per day for a small business, recommend switching Normal events to the daily digest. Protect the owner's attention.

---

## 14. Recommended Delivery Channels

| Channel | Use For | Notes |
|---|---|---|
| **Email** | Default for everything | Always available; full template fits |
| **WhatsApp (to owner)** | Urgent + High, if the owner opts in | Use the short body only (no subject); requires owner's number and consent |
| **Dashboard** | Everything, always | Every notification event also appears on the lead record — the dashboard is the system of record |
| **SMS** | Urgent only, optional | Shortest form: name, phone, one-line reason, callback ask |

Channel rules:

- Every notification is logged to the dashboard regardless of channel.
- Never send the same event on more than two channels.
- Confirm the owner's preferred channel(s) and quiet hours during onboarding, and record them in the client record.

---

## 15. Notification Writing Rules

1. **Lead with the action.** The owner should know what to do within 3 seconds of opening it.
2. **Keep bodies under ~10 lines.** If it needs more, it belongs in the dashboard with a link.
3. **One event, one notification.** Never re-notify the same event; bundle near-simultaneous events.
4. **Never invent data.** Empty field → delete the line. No guessed names, dates, or intents.
5. **Quote, don't interpret.** Customer Message is verbatim (trimmed). Interpretation goes only in Conversation Summary, marked as a summary.
6. **Careful language.** "May need", "asked about", "requested" — never promise revenue, never state the business "is losing customers".
7. **Plain words.** No jargon ("lead nurture sequence"), no internal codes, no emoji in Urgent notifications.
8. **Local timezone, explicit dates.** "Fri, Jun 12 at 2:00 PM", never relative-only ("tomorrow") in stored records — keep the customer's own words in quotes but add the resolved date when known.
9. **The next action is specific.** "Call Maria to confirm Friday 2pm" — not "follow up".
10. **Respect quiet hours** except Urgent.

---

## 16. Industry Examples

All examples below are **illustrative with fictional customer data** — they show formatting only, not real clients.

### Nail salon — New Appointment Request

```
Subject: Appointment request — Maria L. — Friday 2:00 PM

Maria L. requested an appointment with Polished Nail Studio.

Service: Gel manicure + removal
Preferred: Friday at 2:00 PM
Phone: +1 555-0142
Source: Website Chat
Notes: "Do you have anything Friday afternoon? Gel removal plus a new set."

Next action: Confirm Friday 2:00 PM or propose the closest slot, then mark Appointment Confirmed.

Received Wed, Jun 10 at 4:12 PM · View lead: [dashboard link]
```

### Spa — WhatsApp Lead

```
Subject: New WhatsApp lead — Dana K.

WhatsApp lead for Serene Day Spa.

Name: Dana K.
WhatsApp: +1 555-0177
Asked about: Couples massage, weekend availability
Summary: Asked about 60 vs 90 minute options and weekend prices; wants to compare before booking.

Next action: Send weekend availability and the 60/90 minute price difference.

Received Thu, Jun 11 at 10:05 AM · View lead: [dashboard link]
```

### Barbershop — Missed Inquiry Follow-Up

```
Subject: Follow up needed — Jordan T. has not been answered

Jordan T. contacted Fade District and has not received a reply yet.

Waiting since: Tue, Jun 9 at 6:40 PM
Interested in: Skin fade + beard lineup
Phone: +1 555-0119
Source: Instagram
Last message: "You guys open Saturday morning? Need a fade before an event."

Next action: Reply with Saturday morning availability — event-driven requests book elsewhere fast.

View lead: [dashboard link]
```

### Wellness clinic — Urgent Inquiry

```
Subject: URGENT — Priya S. needs a response now

Urgent inquiry for Restore Wellness Clinic.

Name: Priya S.
Phone: +1 555-0163
Why urgent: Reports lower-back pain that got worse today; asking for the earliest possible appointment.
Message: "My back got much worse overnight, can anyone see me today?"
Source: Website Chat

Next action: Call Priya to triage and offer the earliest slot today, or advise next available care.
Respond as soon as possible — urgent inquiries cool off fast.

Received Thu, Jun 11 at 8:51 AM · View lead: [dashboard link]
```

### Dentist — New Lead (Website Chat)

```
Subject: New website chat lead — Alex M.

Website chat lead for Brightside Dental.

Name: Alex M.
Phone: +1 555-0188
Email: alex.m@example.com
Asked about: New patient checkup + cleaning; asked if you accept Delta insurance
Summary: New to the area, looking for a regular dentist; insurance acceptance is the deciding factor.

Next action: Confirm whether Delta is accepted and offer two new-patient slots.

Received Wed, Jun 10 at 1:27 PM · View lead: [dashboard link]
```

---

## 17. Owner Notification QA Checklist

Run for every client before launch, and again during each monthly system check:

- [ ] A test lead from each installed channel (website chat, form, WhatsApp) produces exactly **one** notification
- [ ] The notification arrives on the owner's chosen channel(s) within 2 minutes
- [ ] All required fields render; no `{{placeholder}}` text leaks through
- [ ] Optional lines with no data are removed (no "Email:" with a blank)
- [ ] Appointment requests are clearly worded as **requests to confirm**, not confirmed bookings
- [ ] An urgent test message triggers the Urgent template and bypasses quiet hours
- [ ] A deliberately unanswered test lead triggers the missed-inquiry nudge after the agreed window
- [ ] Daily summary sends at the agreed time and skips empty days
- [ ] Quiet hours hold back non-urgent notifications
- [ ] Dashboard link opens the correct lead record
- [ ] Owner confirms the volume feels right — adjust priorities or switch to digest if not
- [ ] Notification preferences (channels, quiet hours, opted-in status updates) are recorded in the client record

---

## 18. How Helios AI Should Use This File

When drafting, configuring, or reviewing owner notifications for any client:

1. **Pick the template by event type** (sections 4–12) — do not write notification copy from scratch.
2. **Fill placeholders with captured data only.** Unknown value → delete the line. Never fabricate names, dates, services, or intent.
3. **Set priority from section 13** and channels from section 14; respect the client's recorded preferences and quiet hours.
4. **Apply the writing rules** in section 15 to any custom wording a client requests.
5. **Keep field names and statuses consistent** with `Helios AI Lead Capture & Dashboard Schema.md`.
6. **Adapt tone per industry** using section 16 as the reference patterns — same structure, industry-appropriate services and urgency.
7. **Before launch and at every monthly check**, run the QA checklist in section 17.
8. When a client asks for "more notifications", first check whether a digest or dashboard view solves it — protect the owner's attention by default.
