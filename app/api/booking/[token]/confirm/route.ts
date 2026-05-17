import { NextResponse, type NextRequest } from 'next/server'
import { confirmBookingByCustomer } from '@/lib/bookings/confirmation'
import { captureApiError } from '@/lib/logging/api'

// POST /api/booking/[token]/confirm
// Public — validates token server-side. No auth required.

interface Params { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })
  }

  try {
    const result = await confirmBookingByCustomer(token)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Could not confirm booking.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, status: result.status })
  } catch (err) {
    captureApiError(err, { route: '/api/booking/[token]/confirm', error_type: 'customer_confirm_error' })
    return NextResponse.json({ error: 'Could not confirm booking.' }, { status: 500 })
  }
}
