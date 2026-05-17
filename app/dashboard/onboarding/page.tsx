import { Metadata } from 'next'
import PageHeader from '@/components/dashboard/PageHeader'
import { getOnboardingIntake } from '@/lib/actions/onboarding'
import OnboardingClient from './OnboardingClient'

export const metadata: Metadata = { title: 'Client Onboarding — Helios AI' }

export default async function OnboardingPage() {
  const { intake, error } = await getOnboardingIntake()

  return (
    <>
      <PageHeader
        eyebrow="Client Setup"
        title="Onboarding Intake"
        description="Fill in the business details so we can build your AI booking system correctly."
      />
      <OnboardingClient initialIntake={intake} loadError={error} />
    </>
  )
}
