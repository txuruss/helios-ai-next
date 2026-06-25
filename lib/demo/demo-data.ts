// ── Demo Mode — Elite Cuts Barbershop sample data ─────────────────
// All data here is fictional. Used for demos and previews only.
// Never mixes with real customer data.

export const DEMO_BUSINESS = {
  name:           'Elite Cuts Barbershop',
  type:           'Barbershop',
  phone:          '+1 (555) 000-0001',
  email:          'demo@elitecuts.example',
  address:        '123 Main St, Brooklyn, NY 11201',
  description:    'Premium barbershop serving Brooklyn since 2018. Walk-ins welcome. Appointments preferred.',
  hours:          'Mon–Fri 9am–7pm, Sat 9am–5pm',
  is_demo:        true,
}

export const DEMO_SERVICES = [
  { name: 'Classic Haircut',      price_min: 35, price_max: 45, duration_min: 30 },
  { name: 'Beard Trim & Shape',   price_min: 20, price_max: 30, duration_min: 20 },
  { name: 'Haircut + Beard',      price_min: 50, price_max: 65, duration_min: 45 },
  { name: 'Hot Towel Shave',      price_min: 40, price_max: 50, duration_min: 40 },
  { name: 'Kids Cut (under 12)',   price_min: 25, price_max: 30, duration_min: 25 },
]

export const DEMO_FAQS = [
  { question: 'Do you take walk-ins?',              answer: 'Yes! Walk-ins are welcome based on availability. We recommend booking in advance for weekends.' },
  { question: 'How long does a haircut take?',      answer: 'Classic haircuts take about 30–45 minutes. Haircut + beard combos take 45–60 minutes.' },
  { question: 'Do you offer kids cuts?',            answer: 'Yes! Kids cuts (under 12) are $25–$30 and take about 25 minutes.' },
  { question: 'Can I book online?',                 answer: 'Absolutely. Use our booking link or message us here and we\'ll find you a slot.' },
  { question: 'What payment methods do you take?', answer: 'We accept cash, card, Venmo, and CashApp. Tips are appreciated!' },
]

export const DEMO_CONVERSATIONS = [
  {
    id:       'demo-conv-1',
    channel:  'whatsapp',
    status:   'active',
    messages: [
      { role: 'user', content: 'Hi — do you have any openings this Saturday afternoon?', ts: '10:12 AM' },
      { role: 'ai',   content: 'Hi! Yes, we have openings at 1:00 PM, 2:30 PM, and 4:00 PM this Saturday. Which works best for you?', ts: '10:12 AM' },
      { role: 'user', content: 'Perfect, 2:30 PM works.', ts: '10:13 AM' },
      { role: 'ai',   content: 'Great! Booking confirmed for Saturday at 2:30 PM. What service can I put you down for?', ts: '10:13 AM' },
    ],
  },
  {
    id:       'demo-conv-2',
    channel:  'widget',
    status:   'resolved',
    messages: [
      { role: 'user', content: 'How much is a beard trim?',     ts: '9:44 AM' },
      { role: 'ai',   content: 'A beard trim and shape is $20–$30. Takes about 20 minutes. Want to book one?', ts: '9:44 AM' },
      { role: 'user', content: 'Yeah I\'ll come in tomorrow.',   ts: '9:45 AM' },
      { role: 'ai',   content: 'Perfect! We\'re open 9am–7pm weekdays. Walk-ins welcome — or I can book a slot now?', ts: '9:45 AM' },
    ],
  },
]

export const DEMO_LEADS = [
  { name: 'Marcus T.',  source: 'whatsapp', service: 'Haircut + Beard', status: 'new',       created_at: '2 hours ago' },
  { name: 'Devon L.',   source: 'widget',   service: 'Classic Haircut',  status: 'qualified', created_at: '4 hours ago' },
  { name: 'Jalen M.',   source: 'whatsapp', service: 'Hot Towel Shave',  status: 'new',       created_at: 'Yesterday'   },
  { name: 'Terrance B.',source: 'widget',   service: 'Kids Cut',         status: 'contacted', created_at: '2 days ago'  },
]

export const DEMO_BOOKINGS = [
  { name: 'Marcus T.',  service: 'Haircut + Beard', date: 'Today 2:30 PM',     status: 'confirmed' },
  { name: 'Devon L.',   service: 'Classic Haircut', date: 'Today 4:00 PM',     status: 'confirmed' },
  { name: 'Jalen M.',   service: 'Hot Towel Shave', date: 'Tomorrow 10:00 AM', status: 'pending'   },
  { name: 'Kevin R.',   service: 'Beard Trim',      date: 'Tomorrow 11:30 AM', status: 'confirmed' },
]

export const DEMO_MISSION_CONTROL = {
  totalLeads:    12,
  newThisWeek:   4,
  bookingsToday: 6,
  openConvs:     2,
  aiStatus:      'active',
  launchReady:   false,
}

export const DEMO_OPS_ALERTS = [
  { title: 'WhatsApp not connected',        severity: 'warning', source: 'setup'    },
  { title: 'No Cal.com account linked',     severity: 'warning', source: 'setup'    },
  { title: 'Widget not installed on site',  severity: 'info',    source: 'setup'    },
]

// Demo booking (tagged as demo for clean reset)
export const DEMO_BOOKING = {
  customer_name:     'Marcus T.',
  customer_email:    null,         // never use real emails in demo
  service_interest:  'Haircut + Beard',
  notes:             '[Demo] Sample booking request',
  status:            'pending',
  confirmation_status: 'pending',
  metadata:          { demo: true },
}

// Demo ops events (tagged as demo for clean reset)
export const DEMO_OPS_EVENTS = [
  {
    source:     'demo',
    event_type: 'demo_lead_captured',
    severity:   'info',
    title:      '[Demo] Lead captured via website chat',
    metadata:   { demo: true },
  },
  {
    source:     'demo',
    event_type: 'demo_booking_requested',
    severity:   'info',
    title:      '[Demo] Booking request received',
    metadata:   { demo: true },
  },
  {
    source:     'demo',
    event_type: 'demo_owner_notified',
    severity:   'info',
    title:      '[Demo] Owner notification sent',
    metadata:   { demo: true },
  },
]

// Demo audit for Elite Cuts Barbershop (pre-set scores, tagged as demo)
export const DEMO_AUDIT = {
  audit_name:                 'Elite Cuts — Deployment Audit',
  business_name:              'Elite Cuts Barbershop',
  business_type:              'Barbershop',
  source:                     'demo',
  status:                     'completed',
  overall_score:              74,
  response_score:             80,
  booking_score:              70,
  lead_capture_score:         75,
  trust_score:                65,
  automation_score:           70,
  recommended_plan:           'pro',
  estimated_revenue_risk:     '$300 – $800 per month in missed WhatsApp booking requests',
  summary:                    'Demo Ready (74/100). 1 critical gap found. Recommended: Booking OS.',
  metadata:                   { demo: true },
}

export const DEMO_AUDIT_FINDINGS = [
  { category: 'whatsapp',    severity: 'high',   title: 'WhatsApp booking flow needs automation',      description: 'Customers message on WhatsApp but replies require manual effort.', recommendation: 'Connect WhatsApp to Helios AI for automated replies and booking routing.', sort_order: 0 },
  { category: 'booking_flow', severity: 'medium', title: 'Booking confirmation needs owner review',    description: 'Bookings are created but owner must manually confirm each one.', recommendation: 'Enable owner review controls in the booking confirmation flow.', sort_order: 1 },
  { category: 'follow_up',   severity: 'medium', title: 'Lead follow-up should be tracked',           description: '4 leads captured but no systematic follow-up flow exists.', recommendation: 'Use the Inbox and Mission Control to track and respond to every lead.', sort_order: 2 },
  { category: 'response_speed', severity: 'low', title: 'After-hours response is limited',           description: 'Website chat is active but response times after 7pm may be slow.', recommendation: 'The AI assistant handles after-hours questions automatically.', sort_order: 3 },
]

export const DEMO_AUDIT_RECOMMENDATION = {
  recommended_plan:  'pro',
  setup_fee:         '$2,500 setup',
  monthly_fee:       '$499/mo',
  reason:            'Elite Cuts needs a full website + WhatsApp AI assistant with booking flow and owner notifications. Booking OS covers everything.',
  included_features: ['Website AI chat assistant', 'WhatsApp assistant', 'Cal.com booking flow', 'Lead capture', 'Owner notifications', 'Monthly optimization'],
  next_steps:        ['Complete onboarding intake', 'Connect WhatsApp Business', 'Connect Cal.com', 'Add services and FAQs', 'Test booking flow end-to-end'],
}

// Demo template application (barbershop template applied as demo)
export const DEMO_TEMPLATE_APPLICATION = {
  template_key:            'barbershop',
  apply_mode:              'append',
  services_created:        6,
  faqs_created:            5,
  business_fields_updated: false,
  status:                  'completed',
  safe_summary:            'Applied Barbershop template (append): 6 services, 5 FAQs',
  metadata:                { demo: true },
}

// Demo recording script for 2-minute demo
export const DEMO_RECORDING_SCRIPT = [
  { step: 1, title: 'Landing page',        note: 'Show the problem statement and Book a Demo CTA at /' },
  { step: 2, title: 'Open /demo',          note: 'Run the demo flow animation at /demo' },
  { step: 3, title: 'Website chat',        note: 'Show the embedded widget sandbox — reply to "Can I book for Saturday?"' },
  { step: 4, title: 'Lead capture',        note: 'Show leads in /dashboard/leads after demo flow completes' },
  { step: 5, title: 'Booking request',     note: 'Show /dashboard/bookings — pending confirmation badge' },
  { step: 6, title: 'Mission Control',     note: 'Show /dashboard — KPI cards, setup progress, launch readiness' },
  { step: 7, title: 'Inbox handoff',       note: 'Show /dashboard/inbox — AI badge, Pause AI button' },
  { step: 8, title: 'Ops Center safety',   note: 'Show /dashboard/ops — System Health, Production Checks' },
  { step: 9, title: 'Setup checklist',     note: 'Show /dashboard/setup — QA checklist and launch readiness' },
  { step: 10, title: 'Book a Demo CTA',    note: 'Return to / and click "Book a Demo"' },
]
