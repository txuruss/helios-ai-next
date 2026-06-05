import { requireAdminShell } from '@/lib/auth/require-admin'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Path-agnostic gate: admit any admin-capable role (founder_admin or
  // outreach_agent). Each page enforces its own precise path ACL, so the
  // layout must NOT branch on x-pathname (unreliable in Server Components →
  // it would redirect-loop outreach_agent into a black screen).
  const session = await requireAdminShell()
  return <AdminShell session={session}>{children}</AdminShell>
}
