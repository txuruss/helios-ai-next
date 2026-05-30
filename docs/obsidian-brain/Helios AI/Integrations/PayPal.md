# PayPal

## Summary

PayPal is the **planned primary payment provider** for Helios AI. It is **not urgent** before outreach and is **not built** yet.

## Current status

`Deferred` — planned, not built.

- PayPal is configured as the *intended* provider in admin UI/config, but **no checkout, API calls, or payment verification exist**.
- Revenue is always shown as **Estimated** — there is no transaction reading.

> Do not mark PayPal as complete. Do not add fake payment verification in production.

## Planned tasks

- Build PayPal checkout
- Call PayPal API
- Add payment verification
- Mark clients active **after** verified payment
- Connect payment state to the businesses/clients table
- Avoid fake verification in production
- Do not hard-delete important records unless there is a clear reason — use **soft delete or status fields**

## Payment-related statuses to consider

```
lead
audit_submitted
qualified
proposal_sent
invoice_sent
paid
active_client
completed
inactive
archived
```

## Key decisions

- PayPal is **deferred** — the first client can be invoiced/paid manually. (See [[Decision Log]] and [[Client Acquisition Readiness]].)
- Payment verification must happen **server-side**.
- Never auto-mark a client "active" without a verified, real payment.

## Action items

- [ ] Decide manual invoicing method for the first client
- [ ] Build server-side PayPal checkout + verification (post first client)
- [ ] Connect verified payment → client status transition

## See also

[[Mission Control]] · [[System Architecture]] · [[Pricing]] · [[Relevance AI]]

---
*Last updated: 2026-05-29*
