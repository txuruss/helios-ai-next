import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

/**
 * Returns a shared Redis client, or null if Upstash env vars are not configured.
 * Null means rate limiting is gracefully skipped (dev / unconfigured environments).
 */
export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _redis
}
