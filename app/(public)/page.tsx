import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'Helios AI | AI Booking Systems for Local Businesses',
}

export default function HomePage() {
  return <LandingPage />
}
