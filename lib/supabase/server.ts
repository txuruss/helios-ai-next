import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client.
 * Use in Server Components, Server Actions, and Route Handlers.
 * Never use the service role key here — only the anon key.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
            )
          } catch {
            // In Server Components, cookies are read-only.
            // The middleware handles session refresh.
          }
        },
      },
    },
  )
}

/**
 * Service-role client — NEVER call from browser code or client components.
 * Use only in server actions / API routes that require bypassing RLS.
 *
 * Phase 2 usage examples:
 *   - Creating chat sessions for anonymous widget users
 *   - Stripe webhook handler writing subscriptions
 *   - Anthropic response storing chat messages
 */
export function createServiceRoleClient() {
  // Intentionally NOT exported from lib/supabase/client.ts
  // so it can't be tree-shaken into client bundles.
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js') // eslint-disable-line
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
