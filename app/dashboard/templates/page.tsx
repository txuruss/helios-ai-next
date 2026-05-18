import { Metadata } from 'next'
import PageHeader from '@/components/dashboard/PageHeader'
import TemplatesClient from './TemplatesClient'
import { getTemplateApplicationHistory } from '@/lib/actions/templates'
import { NICHE_TEMPLATES, getNicheTemplateKeys } from '@/lib/templates/niche-templates'

export const metadata: Metadata = { title: 'Niche Templates — Helios AI' }

export default async function TemplatesPage() {
  const templates = getNicheTemplateKeys().map((k) => NICHE_TEMPLATES[k])
  const { history } = await getTemplateApplicationHistory()

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Niche Templates"
        description="Start faster with ready-made services, FAQs, booking rules, and AI behavior for local service businesses."
      />
      <TemplatesClient templates={templates} initialHistory={history} />
    </>
  )
}
