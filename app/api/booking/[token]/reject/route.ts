import { NextResponse, type NextRequest } from 'next/server'
import { rejectBookingConfirmation } from '@/lib/bookings/confirmation'
import { captureApiError } from '@/lib/logging/api'

// POST /api/booking/[token]/reject
// Public — validates token server-side. No auth required.

interface Params { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  let reason: string | undefined
  try {
    const body = await request.json() as { reason?: string }
    reason = typeof body?.reason === 'string' ? body.reason.slice(0, 256) : undefined
  } catch { /* reason is optional */ }

  try {
    const result = await rejectBookingConfirmation({
      bookingId:  '',
      token,
      reason,
      actorType:  'customer',
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Could not cancel booking.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureApiError(err, { route: '/api/booking/[token]/reject', error_type: 'customer_reject_error' })
    return NextResponse.json({ error: 'Could not cancel booking.' }, { status: 500 })
  }
}
