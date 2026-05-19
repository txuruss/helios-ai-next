// Lean Baseline: /admin/bookings is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAdminBookingsPage() {
  redirect('/admin/mission-control')
}
