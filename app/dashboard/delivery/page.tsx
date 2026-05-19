// Lean Baseline: /dashboard/delivery is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedDeliveryPage() {
  redirect('/dashboard')
}
