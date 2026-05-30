# Agent Workflows — Helios AI Agency

See also: [[03-mission-control]] | [[05-tech-stack]] | [[06-client-delivery-system]]

> **Business direction:** [[Helios AI/Agents/Agent System]] is canonical for the business-level agent overview. This note stays canonical for **detailed agent specs (inputs/outputs/approval gates)**.

---

## Execution layer

**Intended execution layer: Relevance AI**

The codebase contains `lib/relevance/` with `client.ts` and `relevance-service.ts`, and the `.env.example` includes `RELEVANCE_API_KEY` and `RELEVANCE_REGION`. A route exists at `app/admin/relevance-ai/page.tsx`.

**However:** Whether Relevance AI is fully connected and running agents in production is **not confirmed**. See [[09-open-questions]].

All agent definitions below describe the intended design. Mark builds against these as **planned** until verified.

---

## Agents

---

### 1. Helios AI Orchestrator Agent

**Purpose:** Top-level coordinator. Routes incoming triggers (new lead, booking request, client event) to the correct specialist agent. Manages handoffs and ensures nothing falls through the cracks.

**Inputs:**
- Incoming lead or event payload
- Current client context
- Pipeline stage

**Outputs:**
- Routing decision (which agent handles next)
- Status update to Mission Control
- Optional notification trigger

**Tools it may need:**
- Read from Supabase (client/lead records)
- Write status updates to Supabase
- Trigger other Relevance AI agents
- Send notifications via Resend or WhatsApp

**Human approval points:**
- Escalation decisions (when an edge case is outside agent rules)
- Ambiguous routing with two valid options

**Must never do:**
- Send client-facing messages without approval if it is the first contact
- Modify billing or subscription records
- Delete data

---

### 2. Client Qualifier Agent

**Purpose:** Assess whether an inbound lead is a good fit for Helios AI Agency services.

**Inputs:**
- Lead details (business type, size, current tools, pain points)
- Qualification criteria (business type whitelist, minimum monthly revenue signal, location if relevant)

**Outputs:**
- Qualification score or pass/fail
- Reason for decision
- Recommended package (Starter / Booking OS / Ops Center)
- Flag for human review if uncertain

**Tools it may need:**
- Lead data from Supabase
- Qualification ruleset (defined in lib or agent config)

**Human approval points:**
- Edge cases where the lead does not clearly qualify or disqualify
- High-value outliers outside normal criteria

**Must never do:**
- Auto-reject a lead without human notification
- Send rejection messages to leads directly

---

### 3. Sales Offer Builder Agent

**Purpose:** Generate a tailored offer document or proposal for a qualified lead based on their audit and business type.

**Inputs:**
- Qualified lead profile
- Business audit results
- Recommended package

**Outputs:**
- Draft proposal (text or structured document)
- Suggested pricing range (if pricing rules are defined)
- CTA: book discovery call

**Tools it may need:**
- Lead and audit data from Supabase
- Offer templates from `lib/templates/` or similar
- Resend for delivering the proposal via email

**Human approval points:**
- Proposal must be reviewed and approved by team before sending
- Pricing decisions require founder or sales team approval

**Must never do:**
- Send a proposal without human approval
- Include pricing that has not been confirmed for that client tier

---

### 4. Client Onboarding Agent

**Purpose:** Guide a newly signed client through the onboarding process. Collect required information, configure systems, and prepare the delivery team.

**Inputs:**
- Signed client record
- Package purchased
- Business info collected during sales

**Outputs:**
- Completed onboarding checklist
- Configured AI assistant settings (widget, tone, FAQs)
- Booking flow configuration
- Notification settings
- Handoff to delivery team

**Tools it may need:**
- Supabase read/write (client records, onboarding progress)
- Cal.com API (booking setup)
- WhatsApp API (channel setup)
- Resend (welcome and instruction emails)

**Human approval points:**
- Final review of AI assistant configuration before going live
- Client confirmation of business details

**Must never do:**
- Push changes live to a client's widget or booking system without QA
- Store sensitive client information outside defined schema

---

### 5. Booking System Builder Agent

**Purpose:** Configure and test a client's AI-assisted booking flow using Cal.com or similar.

**Inputs:**
- Client service types and availability
- Booking preferences (lead time, buffer, cancellation rules)
- Confirmation and reminder message templates

**Outputs:**
- Configured booking flow
- Test booking confirmation
- Embedded link or widget code for client website

**Tools it may need:**
- Cal.com API (confirmed in `.env.example` as `CALCOM_API_KEY`)
- Supabase (client config storage)
- Widget settings

**Human approval points:**
- Client must approve final booking flow before going live
- QA checklist must pass

**Must never do:**
- Publish booking links before client approval
- Configure availability that hasn't been confirmed with the client

---

### 6. Delivery QA Agent

**Purpose:** Run a structured QA check on a client's configured systems before launch.

**Inputs:**
- Client setup record
- QA checklist (from [[06-client-delivery-system]])
- Test scenarios

**Outputs:**
- QA report (pass/fail per item)
- List of issues requiring fix
- Launch readiness verdict

**Tools it may need:**
- Supabase (read setup state)
- Web scraping or API testing capability

**Human approval points:**
- All QA failures require human review before launch
- Final launch approval is always human

**Must never do:**
- Mark a client as launch-ready without passing all required checks
- Approve its own output — QA is always confirmed by a team member

---

### 7. Lead Capture Agent

**Purpose:** Receive and log inbound leads from the website chat widget, landing page forms, or direct API.

**Inputs:**
- Lead form submission or chat session
- Source (website, referral, manual entry)

**Outputs:**
- New lead record in Supabase
- Owner notification (email or WhatsApp)
- Trigger to Orchestrator for routing

**Tools it may need:**
- Supabase write
- Resend or WhatsApp notification
- Rate limiting (Upstash Redis — confirmed in stack)

**Human approval points:**
- None required for capturing — capture is automatic
- Routing decision after capture may require human review in edge cases

**Must never do:**
- Silently drop leads without logging
- Store leads outside the defined database schema
- Respond to the lead without confirmation from Orchestrator or Sales Closer

---

### 8. Sales Closer Agent

**Purpose:** Handle follow-up and nurturing for qualified leads moving toward close.

**Inputs:**
- Qualified lead record
- Approved proposal
- Discovery call outcome (if available)

**Outputs:**
- Follow-up message sequence
- Next action recommendation
- Close status update

**Tools it may need:**
- Supabase (lead/pipeline records)
- Resend (email follow-ups)
- WhatsApp API (WhatsApp follow-ups)

**Human approval points:**
- Every outbound message must be approved before sending
- Close/reject decisions require team member confirmation

**Must never do:**
- Send follow-up messages autonomously without approval
- Mark a lead as closed without team confirmation

---

### 9. Project Manager Agent

**Purpose:** Track delivery progress for active clients. Surface blockers, overdue tasks, and milestone status.

**Inputs:**
- Active client records
- Delivery checklist state (from [[06-client-delivery-system]])
- Team task assignments

**Outputs:**
- Daily/weekly delivery status summary
- Overdue task alerts
- Milestone completion notifications

**Tools it may need:**
- Supabase (read delivery/task state)
- Notification tools (Resend, WhatsApp, internal dashboard)

**Human approval points:**
- None for status reporting
- Escalation recommendations require team review

**Must never do:**
- Mark tasks as complete without team confirmation
- Reassign team members without approval

---

## Notes on agent readiness

All agents above are **planned design**. Before building against any of them:

1. Confirm Relevance AI connection status in [[09-open-questions]]
2. Confirm the database tables that each agent reads/writes exist in the Supabase schema
3. Confirm notification integrations (Resend, WhatsApp) are live before wiring agent outputs to them
