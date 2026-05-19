// Lean Baseline: /admin/content is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAdminContentPage() {
  redirect('/admin/mission-control')
}
