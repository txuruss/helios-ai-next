import { z } from 'zod'

export const SETUP_ITEM_KEYS = [
  'business_profile_completed',
  'services_added',
  'faqs_added',
  'booking_rules_added',
  'calcom_connected',
  'whatsapp_connected',
  'widget_installed',
  'test_conversation_completed',
  'owner_notification_tested',
  'launch_approved',
] as const

export type SetupItemKey = typeof SETUP_ITEM_KEYS[number]

export const updateSetupItemSchema = z.object({
  key:   z.enum(SETUP_ITEM_KEYS),
  value: z.boolean(),
})

// ── Demo QA checklist ─────────────────────────────────────────────

export const DEMO_QA_CHECKS = [
  { key: 'landing_page_reviewed',     label: 'Landing page reviewed'         },
  { key: 'demo_page_reviewed',        label: 'Demo page reviewed'            },
  { key: 'business_profile_created',  label: 'Business profile created'      },
  { key: 'services_added',            label: 'Services added'                },
  { key: 'faqs_added',                label: 'FAQs added'                    },
  { key: 'widget_configured',         label: 'Widget configured'             },
  { key: 'test_chat_completed',       label: 'Test chat completed'           },
  { key: 'lead_capture_tested',       label: 'Lead capture tested'           },
  { key: 'notification_tested',       label: 'Owner notification tested'     },
  { key: 'calcom_booking_tested',     label: 'Cal.com booking tested'        },
  { key: 'whatsapp_flow_tested',      label: 'WhatsApp flow tested'          },
  { key: 'inbox_handoff_tested',      label: 'Inbox handoff tested'          },
  { key: 'mission_control_reviewed',  label: 'Mission Control reviewed'      },
  { key: 'ops_center_reviewed',       label: 'Ops Center reviewed'           },
  { key: 'billing_page_reviewed',     label: 'Billing page reviewed'         },
  { key: 'security_env_checked',      label: 'Security / env vars checked'   },
  { key: 'demo_recorded',             label: 'Final demo recorded'           },
] as const

export type DemoQaCheckKey = typeof DEMO_QA_CHECKS[number]['key']

export const updateDemoQaCheckSchema = z.object({
  check_key: z.string().min(1).max(64),
  status:    z.enum(['pending', 'passed', 'failed', 'skipped']),
  notes:     z.string().max(512).optional(),
})

export const toggleAiPausedSchema = z.object({
  paused: z.boolean(),
  reason: z.string().max(256).optional(),
})

export const loadDemoDataSchema = z.object({
  confirm: z.literal(true),
})

// Pure utility — can be used in client and server components
export function computeSetupPercent(progress: Record<string, unknown> | null): number {
  if (!progress) return 0
  const done = SETUP_ITEM_KEYS.filter((k) => !!progress[k]).length
  return Math.round((done / SETUP_ITEM_KEYS.length) * 100)
}

export const SETUP_ITEM_LABELS: Record<SetupItemKey, { label: string; desc: string; href: string; icon: string }> = {
  business_profile_completed:  { label: 'Business Profile',        desc: 'Add your business name, type, hours, and contact info.',         href: '/dashboard/business',  icon: '🏢' },
  services_added:              { label: 'Services Added',           desc: 'List your services and pricing.',                                href: '/dashboard/services',  icon: '✂️' },
  faqs_added:                  { label: 'FAQs Added',              desc: 'Add the questions your customers ask most often.',                href: '/dashboard/services',  icon: '❓' },
  booking_rules_added:         { label: 'Booking Rules Configured', desc: 'Set your availability and booking preferences.',                 href: '/dashboard/calcom',    icon: '📅' },
  calcom_connected:            { label: 'Cal.com Connected',       desc: 'Link your Cal.com account for live booking availability.',        href: '/dashboard/calcom',    icon: '🔗' },
  whatsapp_connected:          { label: 'WhatsApp Connected',      desc: 'Connect your WhatsApp Business number.',                         href: '/dashboard/whatsapp',  icon: '✆' },
  widget_installed:            { label: 'Widget Installed',        desc: 'Add the Helios AI chat widget to your website.',                 href: '/dashboard/widget',    icon: '🌐' },
  test_conversation_completed: { label: 'Test Conversation',       desc: 'Run a test chat to verify the AI responds correctly.',           href: '/dashboard/inbox',     icon: '💬' },
  owner_notification_tested:   { label: 'Notifications Tested',   desc: 'Confirm you receive email alerts when leads come in.',           href: '/dashboard/ops',       icon: '🔔' },
  launch_approved:             { label: 'Launch Approved',         desc: 'Mark your system as live and ready for real customers.',         href: '/dashboard',           icon: '🚀' },
}
