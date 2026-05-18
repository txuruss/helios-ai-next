import { requireClient } from '@/lib/auth/require-client'
import ClientShell from '@/components/client-portal/ClientShell'

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireClient({ redirectFrom: '/client' })
  return <ClientShell session={session}>{children}</ClientShell>
}
