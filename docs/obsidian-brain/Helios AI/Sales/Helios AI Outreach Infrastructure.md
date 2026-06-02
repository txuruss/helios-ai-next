# Helios AI Outreach Infrastructure

## Summary

Do **not** send cold email from the main business domain (`heliosai.agency`) until proper infrastructure exists. Cold email performance can't be judged until deliverability is set up and checked: a separate outreach domain, SPF/DKIM/DMARC, warmup, send limits, and a clean list.

## Status

`Planned` — not yet stood up. Required before any cold email campaign ([[Helios AI Cold Email System]]).

## Outreach setup rules

Use a **separate outreach domain or subdomain** for cold email — keep the primary domain's reputation clean.

| Type | Example |
|------|---------|
| Main domain (keep clean) | `heliosai.agency` |
| Outreach domain (examples) | `tryheliosai.com` · `getheliosai.com` · `heliosaioutreach.com` |

> The outreach domain examples above are **suggestions, not yet registered** — `Needs verification`. Pick and register one before warmup.

## Required technical setup

Before running campaigns:

- [ ] SPF configured
- [ ] DKIM configured
- [ ] DMARC configured
- [ ] Email warmup completed
- [ ] Sender inbox not overloaded
- [ ] Daily send limits respected
- [ ] Unsubscribe / opt-out language included when needed
- [ ] Clean lead list used
- [ ] Invalid emails removed before sending

## The email journey

Every email passes through:

```
Send attempt → Authentication check → Delivery check → Spam filter check → Final destination
```

Final destination can be: **Inbox · Spam folder · Promotions folder · Rejected.**

**Do not judge cold email performance until deliverability is checked.** Replies of zero with broken deliverability is an infrastructure problem, not an offer problem.

## See also

[[Helios AI Cold Email System]] · [[Email Setup]] · [[Helios AI Client Acquisition Doctrine]] · [[Outreach Strategy]]

---
*Last updated: 2026-05-30*
