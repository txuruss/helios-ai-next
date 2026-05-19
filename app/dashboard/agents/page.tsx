// Lean Baseline: /dashboard/agents is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedAgentsPage() {
  redirect('/dashboard')
}
