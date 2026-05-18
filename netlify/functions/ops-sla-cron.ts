// Netlify scheduled function — fires every 10 minutes.
// Replaces vercel.json /api/cron/ops/sla entry.
// Vercel Hobby does not support crons that run more than once per day.

// Inline Config type — no @netlify/functions package needed.
interface NetlifyConfig { schedule: string }

export default async function opsSla() {
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL
  const cronSecret = process.env.CRON_SECRET

  if (!appUrl || !cronSecret) {
    const missing = !appUrl ? 'NEXT_PUBLIC_APP_URL' : 'CRON_SECRET'
    console.error(`[netlify/ops-sla-cron] ${missing} is not set.`)
    return new Response(JSON.stringify({ success: false, error: 'Configuration missing.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await fetch(`${appUrl}/api/cron/ops/sla`, {
      method:  'POST',
      headers: {
        Authorization:    `Bearer ${cronSecret}`,
        'Content-Type':   'application/json',
        'x-cron-trigger': 'netlify',
      },
    })

    console.log(`[netlify/ops-sla-cron] ${response.status}`)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(`[netlify/ops-sla-cron] Error ${response.status}: ${text.slice(0, 120)}`)
      return new Response(JSON.stringify({ success: false, status: response.status }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, status: response.status }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : 'Unknown error'
    console.error('[netlify/ops-sla-cron] Fetch error:', msg)
    return new Response(JSON.stringify({ success: false, error: 'Cron call failed.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config: NetlifyConfig = { schedule: '*/10 * * * *' }
