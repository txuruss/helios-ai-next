import { z } from 'zod'

export const DELIVERY_CATEGORIES = [
  'intake','services','faqs','booking','whatsapp','calcom','widget','qa','launch','handoff',
] as const
export type DeliveryCategory = typeof DELIVERY_CATEGORIES[number]

export const DELIVERY_STATUSES = ['pending','in_progress','blocked','completed','skipped'] as const
export type DeliveryTaskStatus = typeof DELIVERY_STATUSES[number]

export const DELIVERY_PRIORITIES = ['low','normal','high','urgent'] as const
export type DeliveryPriority = typeof DELIVERY_PRIORITIES[number]

export const updateDeliveryTaskSchema = z.object({
  id:             z.string().uuid(),
  status:         z.enum(DELIVERY_STATUSES),
  blocked_reason: z.string().max(512).optional(),
  assigned_to:    z.string().uuid().optional(),
})

export const bulkCreateDeliveryTasksSchema = z.object({
  tasks: z.array(z.object({
    title:       z.string().min(1).max(256),
    description: z.string().max(1000).optional(),
    category:    z.enum(DELIVERY_CATEGORIES),
    priority:    z.enum(DELIVERY_PRIORITIES).default('normal'),
  })).min(1).max(50),
})

// Default task definitions — created once per business on first submit
export const DEFAULT_DELIVERY_TASKS: Array<{
  title: string
  description: string
  category: DeliveryCategory
  priority: DeliveryPriority
}> = [
  { title: 'Review submitted onboarding intake',    description: 'Read business notes, owner contact, services, FAQs, and brand details.',       category: 'intake',    priority: 'urgent'  },
  { title: 'Confirm business profile details',       description: 'Verify name, type, hours, and notification email in /dashboard/business.',     category: 'intake',    priority: 'high'    },
  { title: 'Add or verify services',                 description: 'Enter all services with names, pricing, and duration in /dashboard/services.',  category: 'services',  priority: 'high'    },
  { title: 'Add or verify FAQs',                     description: 'Add the top 5–10 FAQs customers ask to /dashboard/services.',                  category: 'faqs',      priority: 'high'    },
  { title: 'Configure booking rules',                description: 'Set availability, lead time, and cancellation policy in /dashboard/calcom.',    category: 'booking',   priority: 'normal'  },
  { title: 'Connect Cal.com',                        description: 'Link Cal.com API key and map services to event types.',                         category: 'calcom',    priority: 'normal'  },
  { title: 'Connect WhatsApp',                       description: 'Add Meta phone number ID and verify connection in /dashboard/whatsapp.',        category: 'whatsapp',  priority: 'normal'  },
  { title: 'Configure website widget',               description: 'Set embed URL, primary colour, and greeting in /dashboard/widget.',             category: 'widget',    priority: 'normal'  },
  { title: 'Test AI chat',                           description: 'Send test messages through the widget and verify AI replies correctly.',        category: 'qa',        priority: 'high'    },
  { title: 'Test lead capture',                      description: 'Confirm a lead is created in /dashboard/leads after a chat conversation.',     category: 'qa',        priority: 'high'    },
  { title: 'Test owner notification',                description: 'Confirm the owner email is received when a new lead or booking comes in.',     category: 'qa',        priority: 'high'    },
  { title: 'Test booking request',                   description: 'Submit a test booking via the widget and confirm it appears in /dashboard/bookings.', category: 'qa', priority: 'high' },
  { title: 'Test WhatsApp flow',                     description: 'Send a test WhatsApp message and confirm AI replies and lead is captured.',    category: 'qa',        priority: 'normal'  },
  { title: 'Review Inbox handoff',                   description: 'Verify human handoff works and conversation is visible in /dashboard/inbox.',  category: 'qa',        priority: 'normal'  },
  { title: 'Review Mission Control',                 description: 'Confirm KPIs, setup progress, and launch readiness display correctly.',        category: 'qa',        priority: 'normal'  },
  { title: 'Review Ops Center',                      description: 'Check System Health and Production Launch Checklist in /dashboard/ops.',       category: 'qa',        priority: 'normal'  },
  { title: 'Complete Demo QA checklist',             description: 'Mark all 17 QA checks in /dashboard/setup.',                                   category: 'qa',        priority: 'high'    },
  { title: 'Approve launch',                         description: 'Mark the system as live in /dashboard/setup once all checks pass.',            category: 'launch',    priority: 'urgent'  },
  { title: 'Send client handoff instructions',       description: 'Share dashboard URL, login details, and usage guide with the business owner.', category: 'handoff',   priority: 'high'    },
]
