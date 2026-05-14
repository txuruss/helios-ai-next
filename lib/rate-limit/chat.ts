import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from './upstash'

export interface RateLimitResult {
  allowed:   boolean
  reason?:   'ip' | 'business' | 'session'
  limit:     number
  remaining: number
  reset:     number
}

// Module-level singletons — created once per process, counters live in Redis
let _ipLimiter:      Ratelimit | null = null
let _bizLimiter:     Ratelimit | null = null
let _sessionLimiter: Ratelimit | null = null

function getLimiters(): {
  ip:      Ratelimit
  biz:     Ratelimit
  session: Ratelimit
} | null {
  const redis = getRedis()
  if (!redis) return null

  if (!_ipLimiter) {
    _ipLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '10 m'),   // 30 req / 10 min per IP
      prefix:  'hl:chat:ip',
    })
  }

  if (!_bizLimiter) {
    _bizLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '10 m'), // 120 req / 10 min per business
      prefix:  'hl:chat:biz',
    })
  }

  if (!_sessionLimiter) {
    _sessionLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '5 m'),   // 20 req / 5 min per session
      prefix:  'hl:chat:session',
    })
  }

  return { ip: _ipLimiter, biz: _bizLimiter, session: _sessionLimiter }
}

/**
 * Checks three rate limit buckets in order: IP → business_id → session_id.
 * If Upstash is not configured, returns { allowed: true } (safe fallback for dev).
 */
export async function checkChatRateLimit(params: {
  ip:         string
  businessId: string
  sessionId?: string
}): Promise<RateLimitResult> {
  const limiters = getLimiters()

  // Upstash not configured — allow all (dev / staging without Redis)
  if (!limiters) {
    return { allowed: true, limit: 0, remaining: 0, reset: 0 }
  }

  const { ip, businessId, sessionId } = params

  // 1. IP check
  const ipRes = await limiters.ip.limit(ip)
  if (!ipRes.success) {
    return { allowed: false, reason: 'ip', limit: ipRes.limit, remaining: ipRes.remaining, reset: ipRes.reset }
  }

  // 2. Business check
  const bizRes = await limiters.biz.limit(businessId)
  if (!bizRes.success) {
    return { allowed: false, reason: 'business', limit: bizRes.limit, remaining: bizRes.remaining, reset: bizRes.reset }
  }

  // 3. Session check (only when a session_id is already established)
  if (sessionId) {
    const sessRes = await limiters.session.limit(sessionId)
    if (!sessRes.success) {
      return { allowed: false, reason: 'session', limit: sessRes.limit, remaining: sessRes.remaining, reset: sessRes.reset }
    }
  }

  return {
    allowed:   true,
    limit:     ipRes.limit,
    remaining: Math.min(ipRes.remaining, bizRes.remaining),
    reset:     ipRes.reset,
  }
}
