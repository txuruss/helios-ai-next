// Lean Baseline: /dashboard/setup is parked. The setup flow is handled
// inline on /dashboard for the no-business-yet state.
// See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedSetupPage() {
  redirect('/dashboard')
}
