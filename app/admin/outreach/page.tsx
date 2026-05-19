// Lean Baseline: /admin/outreach is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAdminOutreachPage() {
  redirect('/admin/mission-control')
}
