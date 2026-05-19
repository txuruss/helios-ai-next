// Lean Baseline: /admin/revenue is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAdminRevenuePage() {
  redirect('/admin/mission-control')
}
