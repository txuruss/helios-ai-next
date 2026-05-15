// ── WhatsApp template message helpers — server-only ──────────────
// Templates must be pre-approved in Meta Business Manager.
// Only Scale plan users can send templates through the dashboard.

import 'server-only'
import { sendWhatsAppTemplateMessage } from './client'

export interface TemplateSendInput {
  to:           string
  templateName: string
  languageCode: string
}

export interface TemplateSendResult {
  ok:         boolean
  messageId?: string
  error?:     string
}

/**
 * Send a pre-approved WhatsApp template message.
 * Templates are required for outbound-initiated conversations (24h window expired).
 * Must be approved in Meta Business Manager before use.
 */
export async function sendTemplate(input: TemplateSendInput): Promise<TemplateSendResult> {
  const { to, templateName, languageCode } = input
  return sendWhatsAppTemplateMessage(to, templateName, languageCode)
}

/**
 * Returns a safe display name for a template message in the UI log.
 */
export function getTemplateDisplayName(templateName: string, language: string): string {
  return `Template: ${templateName} (${language})`
}
