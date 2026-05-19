// Lean Baseline: /dashboard/onboarding is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedOnboardingPage() {
  redirect('/dashboard')
}
