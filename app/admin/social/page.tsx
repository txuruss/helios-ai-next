// Lean Baseline: /admin/social is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAdminSocialPage() {
  redirect('/admin/mission-control')
}
