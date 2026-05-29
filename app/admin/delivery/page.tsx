import { requireAdmin } from '@/lib/auth/require-admin'
import { getDeliveryData } from '@/lib/data/admin-delivery'
import DeliveryPageClient from './DeliveryPageClient'

export const metadata = { title: 'Delivery — Mission Control' }

export default async function AdminDeliveryPage() {
  await requireAdmin({ path: '/admin/delivery' })

  const { tasks, summary, migrationNeeded, error } = await getDeliveryData()

  return (
    <DeliveryPageClient
      tasks={tasks}
      summary={summary}
      migrationNeeded={migrationNeeded}
      error={error}
    />
  )
}
