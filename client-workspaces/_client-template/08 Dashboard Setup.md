# 08 — Dashboard Setup

> Lead dashboard config for this client. Keep it simple — leads, status, notes.
> Source: [[Helios AI Client Dashboard Setup]] (`source-files/Helios AI Client Dashboard Setup.md`)

---

## Dashboard link

- Link: ______________________
- Login provided to client? ☐ yes ☐ no

## Dashboard users

- Owner: ______________________
- Other users (who actions leads): ______________________

## Lead fields

- Name
- Phone / WhatsApp
- Email
- Service / enquiry type
- Source (website / WhatsApp / form)
- Status
- Date captured
- Notes

## Lead status definitions

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

| Status | When to apply |
|--------|---------------|
| New | Auto-set when a lead comes in |
| Contacted | After first call / message |
| Interested | Customer shows clear intent |
| Booked | Appointment secured |
| Follow-up Needed | Warm lead went quiet; chase |
| Not Interested | Customer declined |
| No Response | No reply after 2–3 attempts |
| Closed | Resolved / no longer active |

## Views needed

- [ ] New leads
- [ ] Follow-up (Contacted + Follow-up Needed)
- [ ] Booked
- [ ] Lost (Not Interested / No Response / Closed)

## Notification connection

- Every new lead triggers owner notification (email / WhatsApp).
- Notification + dashboard show the same data.

## Owner handoff notes

Give the client at handoff:
- Login URL + credentials
- What each status means (table above)
- How to update status + add notes
- Reminder: notifications also arrive by email / WhatsApp
- Daily routine: contact New leads fast, work the Follow-up view, no lead sits on New.

## Dashboard test checklist

- [ ] Client can log in
- [ ] Test lead appears with correct fields
- [ ] Status can be changed
- [ ] Notes can be added + saved
- [ ] Views filter correctly
- [ ] Source recorded correctly
- [ ] Works on mobile
