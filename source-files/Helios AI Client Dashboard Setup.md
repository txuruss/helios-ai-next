# Helios AI Client Dashboard Setup

How to set up a simple client dashboard. Keep it lightweight — leads, status, and notes. Avoid over-building.

---

## Dashboard purpose

Give the client one place to see every captured lead, its status, and what to do next. The dashboard turns the AI assistant's work into visible, actionable results the owner and team can act on.

## Who should access the dashboard

- Business owner (always)
- Front desk / reception or whoever follows up leads
- Limit logins to people who actually action leads
- Record dashboard users from the intake form

## Basic dashboard fields

Each lead record should show:
- Name
- Phone / WhatsApp
- Email
- Service / enquiry type
- Source (website, WhatsApp, form)
- Status
- Date captured
- Notes

## Lead status options

Use these default statuses:

```
New
Contacted
Interested
Booked
Follow-up Needed
Not Interested
No Response
Closed
```

## Lead status definitions

Give the client this table at handoff so the team applies statuses consistently:

| Status | What it means | When to apply |
|--------|---------------|---------------|
| **New** | Just captured, no contact yet | Auto-set when a lead comes in |
| **Contacted** | Team has reached out, awaiting reply | After first call / message |
| **Interested** | Replied and wants to proceed | Customer shows clear intent |
| **Booked** | Appointment confirmed | Booking secured |
| **Follow-up Needed** | Warm but went quiet; chase | No reply after first contact |
| **Not Interested** | Declined | Customer says no |
| **No Response** | No reply after follow-ups | After 2–3 attempts, no answer |
| **Closed** | Resolved or no longer active | Done, or moved to Not Interested/Booked |

## Recommended columns

- Name
- Contact
- Service / enquiry
- Source
- Status
- Date captured
- Last action / note

## New lead view

- Shows all leads with status **New**.
- Newest first.
- The owner's daily starting point — these need a first response.

## Follow-up view

- Shows **Follow-up Needed** and **Contacted** leads.
- Prompts the team to chase warm leads before they go cold.

## Booked leads view

- Shows leads with status **Booked**.
- Confirms the system is producing real appointments.
- Useful for the monthly review.

## Lost leads view

- Shows **Not Interested**, **No Response**, and **Closed**.
- Helps spot patterns (e.g. price objections, slow follow-up).

## Notes and owner actions

- Free-text note per lead for context ("called, will visit Friday").
- Owner can update status as the lead progresses.
- Keep actions simple: update status + add a note.

## Daily lead workflow (for the client)

A simple routine the owner/team follows each day:
1. Open the **New lead** view (or check notifications).
2. Contact every New lead fast → set to **Contacted**.
3. Work the **Follow-up** view → chase warm leads.
4. Move booked customers to **Booked**.
5. Mark dead leads **Not Interested** / **No Response** / **Closed**.

The goal: no lead sits on **New** for long.

## Notification connection

- Every new lead triggers an owner notification (email / WhatsApp).
- The notification links back to or references the dashboard.
- Notification and dashboard must show the same lead data.

## Dashboard testing checklist

- [ ] Client can log in
- [ ] A test lead appears with correct fields
- [ ] Status can be changed
- [ ] Notes can be added and saved
- [ ] Views filter correctly (New / Follow-up / Booked / Lost)
- [ ] Source is recorded correctly
- [ ] Works on mobile

## Dashboard handoff instructions

Give the client:
- Login URL and credentials
- A short "how to use your dashboard" walkthrough
- The meaning of each status
- How to update status and add notes
- Reminder that notifications also arrive by email / WhatsApp

## Common dashboard mistakes to avoid

- Over-building with charts and analytics the client won't use (that's Ops Center territory).
- Too many statuses or custom fields — stick to the defaults.
- Giving logins to people who don't action leads.
- Dashboard data not matching notifications.
- Not testing on mobile.
- Launching without showing the client how to use it.
