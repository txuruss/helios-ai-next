// Lean Baseline: /admin/notifications is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAdminNotificationsPage() {
  redirect('/admin/mission-control')
}
