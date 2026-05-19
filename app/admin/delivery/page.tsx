// Lean Baseline: /admin/delivery is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAdminDeliveryPage() {
  redirect('/admin/mission-control')
}
