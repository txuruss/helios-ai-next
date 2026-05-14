// Development origins always allowed. Production uses ALLOWED_ORIGIN.
const DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
])

/**
 * Returns whether the origin is permitted for authenticated/rate-limited endpoints.
 * Supports comma-separated ALLOWED_ORIGIN in production (e.g. "https://a.com,https://b.com").
 * Use ALLOWED_ORIGIN=* to allow all origins (for public widget deployments).
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false

  if (process.env.NODE_ENV !== 'production') {
    return DEV_ORIGINS.has(origin)
  }

  const raw = process.env.ALLOWED_ORIGIN?.trim()
  if (!raw) return false

  // Wildcard — allow any well-formed HTTP/HTTPS origin
  if (raw === '*') return origin.startsWith('http://') || origin.startsWith('https://')

  // Comma-separated list
  return raw.split(',').map((s) => s.trim()).includes(origin)
}

export type CorsHeaders = Record<string, string>

/**
 * Returns CORS headers for an allowed origin, or {} for a blocked origin.
 * Never returns Access-Control-Allow-Origin: * for restricted endpoints.
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

/**
 * Returns open CORS headers for fully public read-only routes (widget config).
 * Always returns Access-Control-Allow-Origin: * — safe because the route
 * exposes only non-sensitive display configuration.
 */
export function getPublicCorsHeaders(): CorsHeaders {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  }
}
