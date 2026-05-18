import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/auth/require-admin'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hdrs = await headers()
  const path = hdrs.get('x-pathname') ?? '/admin'

  const session = await requireAdmin({ path })
  return <AdminShell session={session}>{children}</AdminShell>
}
