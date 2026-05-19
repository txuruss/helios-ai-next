// Lean Baseline: /dashboard/whatsapp is parked. See docs/PARKED_FEATURES.md.
import { redirect } from 'next/navigation'

export default function ParkedWhatsappPage() {
  redirect('/dashboard')
}
