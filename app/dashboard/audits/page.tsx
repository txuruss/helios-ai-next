import { Metadata } from 'next'
import PageHeader from '@/components/dashboard/PageHeader'
import { getBusinessAudits } from '@/lib/actions/audits'
import AuditDashboardClient from './AuditDashboardClient'

export const metadata: Metadata = { title: 'Deployment Score — Helios AI' }

export default async function AuditsPage() {
  const { audits, error } = await getBusinessAudits()

  return (
    <>
      <PageHeader
        eyebrow="Booking Readiness"
        title="Deployment Score"
        description="Audit your customer response, booking flow, lead capture, and automation gaps."
      />
      <AuditDashboardClient initialAudits={audits} loadError={error} />
    </>
  )
}
