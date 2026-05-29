// ── Client lifecycle status config (manual transitions) ───────────
//
// Pure data — safe for server + client. Defines labels, descriptions,
// allowed manual transitions per current status, and confirmation copy.
// Status changes are ALWAYS manual + confirmed; nothing here mutates.

export type ClientLifecycleStatus = 'onboarding' | 'active' | 'paused' | 'churned' | 'archived'

export const CLIENT_STATUS_VALUES: ClientLifecycleStatus[] =
  ['onboarding', 'active', 'paused', 'churned', 'archived']

export const STATUS_LABELS: Record<ClientLifecycleStatus, string> = {
  onboarding: 'Onboarding',
  active:     'Active',
  paused:     'Paused',
  churned:    'Churned',
  archived:   'Archived',
}

export const STATUS_COLORS: Record<ClientLifecycleStatus, string> = {
  onboarding: '#3b9eff',
  active:     '#22d093',
  paused:     '#ffae3c',
  churned:    '#ff8a7a',
  archived:   '#6a6a6e',
}

export const STATUS_DESCRIPTIONS: Record<ClientLifecycleStatus, string> = {
  onboarding: 'Still being set up. May be excluded from active MRR.',
  active:     'Live — counts toward active clients and MRR.',
  paused:     'Service paused. Not treated as an active delivery account.',
  churned:    'No longer retained. Kept for history and reporting.',
  archived:   'Hidden from active views. The record is preserved (not deleted).',
}

export interface StatusTransition {
  to:    ClientLifecycleStatus
  label: string
}

// Available manual transitions per current status (see spec Step 4).
export const STATUS_TRANSITIONS: Record<ClientLifecycleStatus, StatusTransition[]> = {
  onboarding: [
    { to: 'active',   label: 'Mark active'  },
    { to: 'paused',   label: 'Pause'        },
    { to: 'churned',  label: 'Mark churned' },
    { to: 'archived', label: 'Archive'      },
  ],
  active: [
    { to: 'onboarding', label: 'Move to onboarding' },
    { to: 'paused',     label: 'Pause'              },
    { to: 'churned',    label: 'Mark churned'       },
    { to: 'archived',   label: 'Archive'            },
  ],
  paused: [
    { to: 'active',     label: 'Resume active'      },
    { to: 'onboarding', label: 'Move to onboarding' },
    { to: 'churned',    label: 'Mark churned'       },
    { to: 'archived',   label: 'Archive'            },
  ],
  churned: [
    { to: 'active',   label: 'Reactivate' },
    { to: 'archived', label: 'Archive'    },
  ],
  archived: [
    { to: 'onboarding', label: 'Restore to onboarding' },
    { to: 'active',     label: 'Restore active'        },
  ],
}

export interface StatusConfirmCopy {
  title:        string
  body:         string
  confirmLabel: string
}

// Confirmation copy keyed by the TARGET status.
export const STATUS_CONFIRM_COPY: Record<ClientLifecycleStatus, StatusConfirmCopy> = {
  onboarding: {
    title: 'Move client to onboarding?',
    body:  'This marks the client as still being set up. Revenue calculations may exclude this client from active MRR depending on current logic.',
    confirmLabel: 'Confirm status change',
  },
  active: {
    title: 'Mark client active?',
    body:  'This marks the client as active. Active clients can count toward active client totals and MRR.',
    confirmLabel: 'Confirm status change',
  },
  paused: {
    title: 'Pause this client?',
    body:  'This keeps the client record but marks service as paused. Paused clients should not be treated as active delivery accounts.',
    confirmLabel: 'Confirm status change',
  },
  churned: {
    title: 'Mark client as churned?',
    body:  'This marks the client as no longer retained. The record stays available for history and reporting.',
    confirmLabel: 'Confirm status change',
  },
  archived: {
    title: 'Archive this client?',
    body:  'This removes the client from active views without deleting the record.',
    confirmLabel: 'Archive client',
  },
}

export function isClientLifecycleStatus(v: unknown): v is ClientLifecycleStatus {
  return typeof v === 'string' && (CLIENT_STATUS_VALUES as string[]).includes(v)
}
