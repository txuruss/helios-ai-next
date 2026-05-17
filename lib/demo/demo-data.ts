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
