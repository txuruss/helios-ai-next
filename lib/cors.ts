// Development origins always allowed. Production uses only ALLOWED_ORIGIN.
const DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
])

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false

  // Always allow localhost in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    return DEV_ORIGINS.has(origin)
  }

  // Production: require explicit ALLOWED_ORIGIN — never fall back to wildcard
  const allowed = process.env.ALLOWED_ORIGIN?.trim()
  if (!allowed) return false

  return origin === allowed
}

export type CorsHeaders = Record<string, string>

/**
 * Returns CORS headers for an allowed origin, or {} for a blocked origin.
 * Never returns Access-Control-Allow-Origin: *.
 */
export function getCorsHeaders(origin: string | null): CorsHeaders {
  if (!isOriginAllowed(origin) || !origin) return {}
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  }
}
