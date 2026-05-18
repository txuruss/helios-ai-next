// ── Niche Templates — client-safe constants ────────────────────────
// Used for template previews, apply logic, and demo data seeding.
// No server-only code here — safe to import in both client and server.

export type NicheTemplateKey =
  | 'barbershop' | 'hair_salon' | 'beauty_spa'
  | 'clinic' | 'cleaning_company' | 'auto_repair' | 'tutor'

export type SetupComplexity = 'simple' | 'standard' | 'advanced'
export type TemplatePlan    = 'starter' | 'pro' | 'scale'

export interface TemplateService {
  name:         string
  price_range?: string
  duration?:    string
}

export interface TemplateFaq {
  question: string
  answer:   string
}

export interface NicheTemplate {
  key:                 NicheTemplateKey
  name:                string
  businessType:        string
  description:         string
  recommendedPlan:     TemplatePlan
  setupComplexity:     SetupComplexity
  estimatedSetupTime:  string
  idealFor:            string[]
  services:            TemplateService[]
  faqs:                TemplateFaq[]
  bookingRules:        string
  aiPersona:           string
  widgetIntro:         string
  whatsappIntro:       string
  demoMessages:        string[]
  icon:                string
}

export const NICHE_TEMPLATES: Record<NicheTemplateKey, NicheTemplate> = {

  barbershop: {
    key:               'barbershop',
    name:              'Barbershop',
    businessType:      'Barbershop',
    description:       'Classic barbershop setup with haircut services, booking rules, and friendly AI assistant.',
    recommendedPlan:   'pro',
    setupComplexity:   'standard',
    estimatedSetupTime: '2–3 days',
    idealFor:          ['Walk-in and appointment barbershops', 'Solo barbers', 'Multi-chair shops'],
    icon:              '✂️',
    services: [
      { name: 'Classic Haircut',       price_range: '$35–$45',  duration: '30 min' },
      { name: 'Beard Trim & Shape',    price_range: '$20–$30',  duration: '20 min' },
      { name: 'Haircut + Beard Combo', price_range: '$50–$65',  duration: '45 min' },
      { name: 'Kids Cut (under 12)',   price_range: '$25–$30',  duration: '25 min' },
      { name: 'Line Up / Edge Up',     price_range: '$15–$25',  duration: '15 min' },
      { name: 'Hot Towel Shave',       price_range: '$40–$55',  duration: '40 min' },
    ],
    faqs: [
      { question: 'Do you take walk-ins?',               answer: 'Yes! Walk-ins are welcome based on availability. We recommend booking ahead on weekends.' },
      { question: 'Can I book online?',                  answer: 'Absolutely. Message us here and we can book a slot, or use our online booking link.' },
      { question: 'How long does a haircut take?',       answer: 'Classic haircuts take about 30–45 minutes. Combo cuts take 45–60 minutes.' },
      { question: 'What payment methods do you accept?', answer: 'We accept cash, card, Venmo, and CashApp. Tips are always appreciated!' },
      { question: 'Can I choose my barber?',             answer: 'Yes! Just let us know your preferred barber when booking and we will do our best to accommodate.' },
    ],
    bookingRules: 'Ask for: preferred service, date, time, barber preference (optional), customer name, and phone number. Do not finalize without confirming availability.',
    aiPersona:   'Friendly, direct, and professional. Speak like a local barber — warm but efficient. Always push toward booking. Use "we" and "our team".',
    widgetIntro: 'Hey! 👋 Welcome to [Business Name]. What can we help you with today?',
    whatsappIntro: 'Hi there! 👋 This is [Business Name]\'s AI assistant. How can we help you today?',
    demoMessages: [
      'How much is a haircut?',
      'Can I book for Saturday?',
      'Do you take walk-ins?',
      'I want a haircut and beard trim.',
      'What are your hours?',
    ],
  },

  hair_salon: {
    key:               'hair_salon',
    name:              'Hair Salon',
    businessType:      'Hair Salon',
    description:       'Full-service salon setup with styling, coloring, and treatment services.',
    recommendedPlan:   'pro',
    setupComplexity:   'standard',
    estimatedSetupTime: '2–3 days',
    idealFor:          ['Female-focused salons', 'Natural hair studios', 'Full-service hair salons'],
    icon:              '💇',
    services: [
      { name: 'Wash & Style',          price_range: '$45–$75',   duration: '45–60 min' },
      { name: 'Silk Press',            price_range: '$65–$100',  duration: '60–90 min' },
      { name: 'Braids Consultation',   price_range: 'From $80',  duration: '90 min+'   },
      { name: 'Hair Coloring',         price_range: '$80–$180',  duration: '90–180 min' },
      { name: 'Deep Conditioning',     price_range: '$35–$55',   duration: '30–45 min' },
      { name: 'Bridal / Event Styling',price_range: 'From $120', duration: '60–120 min' },
    ],
    faqs: [
      { question: 'Do I need a consultation first?',     answer: 'For color, extensions, or major changes, yes. We prefer a quick chat before your appointment.' },
      { question: 'How long does hair coloring take?',   answer: 'Color services typically take 1.5 to 3 hours depending on your hair length and goal.' },
      { question: 'Do you require a deposit?',           answer: 'For longer services over $100, we do ask for a small deposit at the time of booking.' },
      { question: 'Can I reschedule my appointment?',    answer: 'Yes! Please give us at least 24 hours notice to avoid a rescheduling fee.' },
    ],
    bookingRules: 'Ask for: preferred service, hair type or condition, stylist preference (if any), preferred date and time, and customer contact. For coloring services, note if a consultation is needed.',
    aiPersona:   'Warm, encouraging, and stylish. Speak like a friendly stylist who genuinely cares about each customer\'s hair. Use "we" and "our stylists".',
    widgetIntro: 'Hi! 💇 Welcome to [Business Name]. Ready to book your next hair appointment?',
    whatsappIntro: 'Hi! 💇 This is [Business Name]\'s booking assistant. How can we help you today?',
    demoMessages: [
      'How much is a silk press?',
      'Can I get my hair colored?',
      'Do I need a consultation?',
      'I want to book a wash and style.',
      'Do you do braids?',
    ],
  },

  beauty_spa: {
    key:               'beauty_spa',
    name:              'Beauty Spa',
    businessType:      'Spa',
    description:       'Relaxation-focused spa setup with treatments, packages, and gift card FAQ support.',
    recommendedPlan:   'pro',
    setupComplexity:   'standard',
    estimatedSetupTime: '2–3 days',
    idealFor:          ['Day spas', 'Nail bars', 'Lash studios', 'Wellness centers'],
    icon:              '🧖',
    services: [
      { name: 'Signature Facial',      price_range: '$75–$110',  duration: '60 min' },
      { name: 'Full Body Wax',         price_range: '$60–$90',   duration: '45–60 min' },
      { name: 'Swedish Massage',       price_range: '$80–$120',  duration: '60–90 min' },
      { name: 'Gel Manicure',          price_range: '$35–$55',   duration: '45 min' },
      { name: 'Pedicure + Massage',    price_range: '$55–$80',   duration: '60 min' },
      { name: 'Lash Extension Set',    price_range: '$90–$140',  duration: '90–120 min' },
    ],
    faqs: [
      { question: 'Do I need to book ahead?',            answer: 'Yes, we recommend booking at least 48 hours in advance, especially on weekends.' },
      { question: 'What should I do before a facial?',   answer: 'Come with clean skin and no heavy makeup. Avoid sun exposure 24 hours beforehand.' },
      { question: 'Do you offer spa packages?',          answer: 'Yes! We have a few curated packages. Ask us about current offers when you message.' },
      { question: 'Can I buy a gift card?',              answer: 'Absolutely! Gift cards are available in any amount. Contact us to arrange one.' },
    ],
    bookingRules: 'Ask for: treatment type, preferred date and time, any allergies or sensitivities, customer name, and contact number. For lash or wax appointments, ask about any relevant conditions.',
    aiPersona:   'Calm, welcoming, and professional. Speak like a relaxing spa experience — soothing and reassuring. Use "our team" and "we look forward to seeing you".',
    widgetIntro: 'Welcome to [Business Name] ✨ How can we help you relax and feel beautiful today?',
    whatsappIntro: 'Hi there! ✨ This is [Business Name]. Ready to book your next spa experience?',
    demoMessages: [
      'What facials do you offer?',
      'Can I book a massage for Saturday?',
      'Do you have lash appointments?',
      'How much is a manicure?',
      'Do you have gift cards?',
    ],
  },

  clinic: {
    key:               'clinic',
    name:              'Clinic',
    businessType:      'Clinic',
    description:       'Appointment-based clinic setup with safety guidelines and human review controls.',
    recommendedPlan:   'scale',
    setupComplexity:   'advanced',
    estimatedSetupTime: '3–5 days',
    idealFor:          ['GP clinics', 'Aesthetic clinics', 'Physiotherapy', 'Dental practices'],
    icon:              '🏥',
    services: [
      { name: 'New Patient Consultation',  duration: '30–60 min' },
      { name: 'Follow-up Appointment',     duration: '15–30 min' },
      { name: 'Lab Result Review',         duration: '15–20 min' },
      { name: 'General Appointment Request' },
      { name: 'Specialist Referral Inquiry' },
    ],
    faqs: [
      { question: 'Do you accept new patients?',      answer: 'Yes! Please message us and we can arrange a new patient intake appointment.' },
      { question: 'What should I bring?',             answer: 'Please bring a valid ID, insurance card if applicable, and any previous medical records relevant to your visit.' },
      { question: 'Do you accept insurance?',         answer: 'We work with several providers. Please contact us directly to confirm your coverage before your visit.' },
      { question: 'How do I reschedule?',             answer: 'Please contact us at least 24 hours before your appointment to reschedule without a fee.' },
    ],
    bookingRules: 'IMPORTANT: Do NOT provide medical diagnoses. Collect only safe appointment request details: reason for visit (brief), preferred date and time, patient name and contact. For urgent or emergency situations, direct patients to call emergency services or the clinic directly. Flag sensitive medical questions for human review.',
    aiPersona:   'Professional, calm, and safe. Never diagnose or advise on medical treatments. Always recommend speaking directly with a clinician. Use "our clinical team" and "we encourage you to speak with your doctor". Route sensitive questions to human review immediately.',
    widgetIntro: 'Welcome to [Clinic Name]. How can we help you today? We can assist with appointment requests and general questions.',
    whatsappIntro: 'Hi! This is [Clinic Name]\'s appointment assistant. We can help you book an appointment. For medical emergencies, please call 911 or your emergency number.',
    demoMessages: [
      'I need a new patient appointment.',
      'Can I book a follow-up?',
      'Do you accept new patients?',
      'What should I bring to my appointment?',
    ],
  },

  cleaning_company: {
    key:               'cleaning_company',
    name:              'Cleaning Company',
    businessType:      'Cleaning',
    description:       'Residential and commercial cleaning booking with address and room details.',
    recommendedPlan:   'starter',
    setupComplexity:   'simple',
    estimatedSetupTime: '1–2 days',
    idealFor:          ['Residential cleaning', 'Office cleaning', 'Post-construction cleaning'],
    icon:              '🧹',
    services: [
      { name: 'Standard Residential Clean', price_range: '$80–$150',  duration: '2–4 hrs' },
      { name: 'Deep Cleaning',              price_range: '$150–$280', duration: '4–6 hrs' },
      { name: 'Move-in / Move-out Clean',   price_range: '$180–$350', duration: '4–7 hrs' },
      { name: 'Office / Commercial Clean',  price_range: 'Custom',    duration: 'Varies' },
      { name: 'Post-construction Clean',    price_range: 'Custom',    duration: 'Varies' },
    ],
    faqs: [
      { question: 'Do you bring your own supplies?',   answer: 'Yes! We bring all necessary cleaning products and equipment. Just let us know if you have any preferences.' },
      { question: 'How is pricing calculated?',        answer: 'Pricing is based on the size of the property, type of clean, and any add-ons. We can give you a quote when you message us.' },
      { question: 'Do I need to be home?',             answer: 'Not necessarily. Many clients provide a key or entry code. We are fully insured and bonded.' },
      { question: 'Can I book recurring cleaning?',    answer: 'Yes! We offer weekly, bi-weekly, and monthly recurring services at a discounted rate.' },
    ],
    bookingRules: 'Ask for: type of cleaning service, property type (house/apartment/office), number of bedrooms and bathrooms, preferred date and time, approximate address area (no full address needed yet), and customer contact. For commercial or post-construction, ask for square footage.',
    aiPersona:   'Friendly, efficient, and trustworthy. Speak like a reliable local cleaner — helpful and detail-oriented. Use "our team" and "we are fully insured".',
    widgetIntro: 'Hi! 🧹 Welcome to [Business Name]. Ready to get a quote or book a cleaning?',
    whatsappIntro: 'Hi! 🧹 This is [Business Name]. How can we help you today? We offer residential, office, and deep cleaning services.',
    demoMessages: [
      'How much is a deep clean?',
      'Can I book a move-out cleaning?',
      'Do you bring your own supplies?',
      'I need a weekly recurring clean.',
    ],
  },

  auto_repair: {
    key:               'auto_repair',
    name:              'Auto Repair Shop',
    businessType:      'Auto Repair',
    description:       'Vehicle service booking with make/model collection and diagnosis handling.',
    recommendedPlan:   'pro',
    setupComplexity:   'standard',
    estimatedSetupTime: '2–3 days',
    idealFor:          ['Mechanic shops', 'Tyre centres', 'Auto detailing', 'Car service businesses'],
    icon:              '🔧',
    services: [
      { name: 'Diagnostic Check',       price_range: '$50–$90',   duration: '30–60 min' },
      { name: 'Oil Change',             price_range: '$40–$80',   duration: '30 min' },
      { name: 'Brake Inspection/Service',price_range: '$80–$200', duration: '60–120 min' },
      { name: 'Battery Replacement',    price_range: '$80–$160',  duration: '30 min' },
      { name: 'Tyre Service',           price_range: '$25+',      duration: '30–60 min' },
      { name: 'General Repair Request', duration: 'By quote' },
    ],
    faqs: [
      { question: 'Do I need an appointment?',           answer: 'Appointments are preferred but we do accept walk-ins for simple services like oil changes when time allows.' },
      { question: 'Can I get a quote before booking?',   answer: 'Absolutely. Tell us your vehicle and issue and we can give you a rough estimate.' },
      { question: 'How long does a diagnostic take?',    answer: 'A diagnostic usually takes 30–60 minutes. We will contact you with findings before any repairs.' },
      { question: 'Do you work on all car brands?',      answer: 'We work on most makes and models. Send us your vehicle details and we can confirm.' },
    ],
    bookingRules: 'Ask for: vehicle make, model, and year; description of the issue or service needed; preferred appointment date and time; customer name and contact number. For diagnostic requests, remind the customer we will contact them before any repair work begins.',
    aiPersona:   'Straightforward, knowledgeable, and honest. Speak like a trusted local mechanic — direct and no-nonsense. Use "our technicians" and "we will inspect and advise".',
    widgetIntro: 'Hey! 🔧 Welcome to [Business Name]. What can we help you with today?',
    whatsappIntro: 'Hi! 🔧 This is [Business Name]\'s booking assistant. Tell us about your vehicle and we can help.',
    demoMessages: [
      'I need an oil change.',
      'Can I get a quote for brakes?',
      'My car is making a strange noise.',
      'Can I book a diagnostic for Tuesday?',
    ],
  },

  tutor: {
    key:               'tutor',
    name:              'Tutor / Education',
    businessType:      'Education',
    description:       'Tutoring session booking with subject and age group collection.',
    recommendedPlan:   'starter',
    setupComplexity:   'simple',
    estimatedSetupTime: '1–2 days',
    idealFor:          ['Private tutors', 'Online tutoring centres', 'Exam prep services'],
    icon:              '📚',
    services: [
      { name: 'Math Tutoring',         price_range: '$40–$80/hr'  },
      { name: 'English / Writing',     price_range: '$40–$80/hr'  },
      { name: 'Exam Preparation',      price_range: '$50–$90/hr'  },
      { name: 'Homework Help Session', price_range: '$30–$60/hr'  },
      { name: 'Online Tutoring',       price_range: '$35–$70/hr'  },
      { name: 'Free Consultation',     price_range: 'Free',       duration: '15 min' },
    ],
    faqs: [
      { question: 'Do you offer online sessions?',     answer: 'Yes! We offer both in-person and online sessions via Zoom or Google Meet. Let us know your preference.' },
      { question: 'What ages or grades do you teach?', answer: 'We work with students from primary school through to university. Tell us the grade or level and subject.' },
      { question: 'How long is each session?',         answer: 'Sessions are typically 60 or 90 minutes. We can discuss what works best for the student.' },
      { question: 'Do you offer packages?',            answer: 'Yes! We offer discounted session packages for regular bookings. Ask us about our current rates.' },
    ],
    bookingRules: 'Ask for: subject needed, student age or school grade, preferred schedule (days and times), online or in-person preference, parent or guardian contact details if student is under 18.',
    aiPersona:   'Encouraging, patient, and educational. Speak like a supportive tutor who believes every student can improve. Use "our tutors" and "we focus on building confidence".',
    widgetIntro: 'Hi! 📚 Welcome to [Business Name]. What subject can we help your student with today?',
    whatsappIntro: 'Hi! 📚 This is [Business Name]\'s tutoring assistant. What subject and grade level can we help with?',
    demoMessages: [
      'Do you offer math tutoring?',
      'Can I book a trial session?',
      'Do you do online lessons?',
      'My son needs help with GCSE maths.',
    ],
  },

}

// ── Helpers ───────────────────────────────────────────────────────

export function getNicheTemplate(key: string): NicheTemplate | null {
  return NICHE_TEMPLATES[key as NicheTemplateKey] ?? null
}

export function getNicheTemplateKeys(): NicheTemplateKey[] {
  return Object.keys(NICHE_TEMPLATES) as NicheTemplateKey[]
}

export function getRecommendedTemplateByBusinessType(businessType: string | null): NicheTemplate | null {
  if (!businessType) return null
  const lower = businessType.toLowerCase()

  if (lower.includes('barber'))              return NICHE_TEMPLATES.barbershop
  if (lower.includes('hair') && lower.includes('salon')) return NICHE_TEMPLATES.hair_salon
  if (lower.includes('salon'))               return NICHE_TEMPLATES.hair_salon
  if (lower.includes('spa') || lower.includes('beauty') || lower.includes('nail') || lower.includes('lash')) return NICHE_TEMPLATES.beauty_spa
  if (lower.includes('clinic') || lower.includes('medical') || lower.includes('dental') || lower.includes('physio')) return NICHE_TEMPLATES.clinic
  if (lower.includes('clean'))               return NICHE_TEMPLATES.cleaning_company
  if (lower.includes('auto') || lower.includes('car') || lower.includes('mechanic') || lower.includes('repair')) return NICHE_TEMPLATES.auto_repair
  if (lower.includes('tutor') || lower.includes('education') || lower.includes('teach') || lower.includes('school')) return NICHE_TEMPLATES.tutor

  // Helios business type constants
  if (lower.includes('fitness') || lower.includes('gym'))  return NICHE_TEMPLATES.beauty_spa
  if (lower.includes('home service'))                       return NICHE_TEMPLATES.cleaning_company

  return null
}
