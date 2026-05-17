// ── AI Confidence Indicator — server-safe utility ─────────────────
// Rule-based confidence scoring for AI chat responses.
// Does not claim statistical model confidence — purely rule-based.
// Safe to import in server routes. No 'server-only' tag so it can
// also be used in shared validation files.

export type AiConfidence = 'high' | 'medium' | 'low' | 'needs_review'

export interface ConfidenceResult {
  confidence:      AiConfidence
  reason:          string
  requiresReview:  boolean
}

// Keywords that signal the customer needs human attention
const HANDOFF_TRIGGERS = [
  'human', 'agent', 'speak to someone', 'talk to someone', 'real person',
  'manager', 'supervisor', 'complaint', 'upset', 'frustrated', 'unhappy',
  'cancel my account', 'legal', 'lawsuit', 'refund dispute',
]

const UNCERTAINTY_TRIGGERS = [
  'cancel', 'reschedule', 'change my booking', 'modify', 'different time',
  'not available', 'already booked', 'wait list', 'emergency', 'urgent',
  'complaint', 'problem', 'issue', 'wrong',
]

const LOW_CONFIDENCE_TRIGGERS = [
  'price', 'how much', 'cost', 'discount', 'deal', 'promotion', 'insurance',
  'policy', 'refund', 'guarantee', 'contract', 'legal', 'liability',
]

// ── Main function ─────────────────────────────────────────────────

export function calculateAiConfidence(params: {
  userMessage:        string
  aiReply?:           string
  hasFaqMatch:        boolean
  hasServiceMatch:    boolean
  hasBookingDetails:  boolean
  isHandoffActive:    boolean
  isBusinessPaused:   boolean
  isConvPaused:       boolean
  missingBusinessData: boolean
}): ConfidenceResult {
  const {
    userMessage,
    hasFaqMatch,
    hasServiceMatch,
    hasBookingDetails,
    isHandoffActive,
    isBusinessPaused,
    isConvPaused,
    missingBusinessData,
  } = params

  const msgLower = userMessage.toLowerCase()

  // Needs review — human escalation signals
  if (isHandoffActive || isBusinessPaused || isConvPaused) {
    return {
      confidence:     'needs_review',
      reason:         isHandoffActive ? 'Human handoff is active' : 'AI is paused for this conversation',
      requiresReview: true,
    }
  }

  if (HANDOFF_TRIGGERS.some((t) => msgLower.includes(t))) {
    return {
      confidence:     'needs_review',
      reason:         'Customer requested human assistance',
      requiresReview: true,
    }
  }

  if (UNCERTAINTY_TRIGGERS.some((t) => msgLower.includes(t))) {
    return {
      confidence:     'needs_review',
      reason:         'Message relates to booking change or complaint',
      requiresReview: true,
    }
  }

  // Low confidence — sensitive topics without data
  if (LOW_CONFIDENCE_TRIGGERS.some((t) => msgLower.includes(t)) && !hasFaqMatch) {
    return {
      confidence:     'low',
      reason:         'Question about pricing or policy without FAQ match',
      requiresReview: false,
    }
  }

  if (missingBusinessData) {
    return {
      confidence:     'low',
      reason:         'Business profile or service data incomplete',
      requiresReview: false,
    }
  }

  // High confidence — clear match
  if (hasFaqMatch && hasServiceMatch && hasBookingDetails) {
    return {
      confidence:     'high',
      reason:         'FAQ matched, service identified, booking details complete',
      requiresReview: false,
    }
  }
  if (hasFaqMatch || hasServiceMatch) {
    return {
      confidence:     'high',
      reason:         hasFaqMatch ? 'FAQ matched clearly' : 'Service matched clearly',
      requiresReview: false,
    }
  }

  // Medium — default when no specific signal
  return {
    confidence:     'medium',
    reason:         'General reply — no specific FAQ or service match',
    requiresReview: false,
  }
}

export function getConfidenceLabel(confidence: AiConfidence): string {
  const labels: Record<AiConfidence, string> = {
    high:         'High',
    medium:       'Medium',
    low:          'Low',
    needs_review: 'Needs Review',
  }
  return labels[confidence]
}

export function getConfidenceColor(confidence: AiConfidence): string {
  const colors: Record<AiConfidence, string> = {
    high:         '#22d093',
    medium:       '#ffae3c',
    low:          '#ff8a7a',
    needs_review: '#c084fc',
  }
  return colors[confidence]
}

export function shouldRequireAiReview(confidence: AiConfidence): boolean {
  return confidence === 'needs_review'
}
