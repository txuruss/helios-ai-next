import { createHash } from 'crypto'

// Short salt derived from a server-side secret — keeps the hash consistent per deploy
// but not reversible without the salt.
function getSalt(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'helios-log-salt').slice(-8)
}

/**
 * Returns a deterministic 12-char hex token for an IP address.
 * Consistent enough to correlate abuse across requests, but not reversible.
 * Never log the raw IP.
 */
export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + getSalt())
    .digest('hex')
    .slice(0, 12)
}

// ── Safe log event shape ──────────────────────────────────────────

export interface ApiLogEvent {
  route:              string
  status:             number
  business_id?:       string
  session_id?:        string
  ip_hash:            string
  origin:             string | null
  origin_allowed:     boolean
  rate_limit:         'allowed' | 'blocked_ip' | 'blocked_business' | 'blocked_session' | 'skipped'
  body_size_bytes?:   number
  input_chars?:       number
  output_chars?:      number
  error_type?:        string
  ms?:                number
}

/**
 * Structured server-side log line.
 *
 * Safe to log: status, hashed IP, origin, rate limit outcome, char counts, error type.
 * Never logged: full messages, API keys, service role key, raw Anthropic/Supabase errors.
 */
export function logApiEvent(event: ApiLogEvent): void {
  const parts: string[] = [
    `[api/${event.route}]`,
    `status=${event.status}`,
    `biz=${event.business_id ? event.business_id.slice(0, 8) : 'none'}`,
    `sess=${event.session_id ? event.session_id.slice(0, 8) : 'none'}`,
    `ip=${event.ip_hash}`,
    `origin_ok=${event.origin_allowed}`,
    `rl=${event.rate_limit}`,
  ]
  if (event.body_size_bytes !== undefined) parts.push(`body=${event.body_size_bytes}B`)
  if (event.input_chars     !== undefined) parts.push(`in=${event.input_chars}c`)
  if (event.output_chars    !== undefined) parts.push(`out=${event.output_chars}c`)
  if (event.error_type)                    parts.push(`err=${event.error_type}`)
  if (event.ms              !== undefined) parts.push(`ms=${event.ms}`)

  console.log(new Date().toISOString(), parts.join(' '))
}
