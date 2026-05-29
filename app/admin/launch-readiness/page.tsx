import { requireAdmin } from '@/lib/auth/require-admin'
import { getLaunchReadinessData } from '@/lib/data/admin-launch-readiness'
import LaunchReadinessClient from './LaunchReadinessClient'

export const metadata = { title: 'Launch Readiness — Mission Control' }

export default async function AdminLaunchReadinessPage() {
  await requireAdmin({ path: '/admin/launch-readiness' })

  const { rows, summary, filesMigrationNeeded, tasksMigrationNeeded, error } = await getLaunchReadinessData()

  return (
    <LaunchReadinessClient
      rows={rows}
      summary={summary}
      filesMigrationNeeded={filesMigrationNeeded}
      tasksMigrationNeeded={tasksMigrationNeeded}
      error={error}
    />
  )
}
