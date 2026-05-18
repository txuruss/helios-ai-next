import { headers } from 'next/headers'
import { requireTeam } from '@/lib/auth/require-team'
import TeamShell from '@/components/team-portal/TeamShell'

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Pull the path from the request so requireTeam can apply role ACL.
  const hdrs = await headers()
  const path = hdrs.get('x-pathname') ?? '/team'

  // The team login page is inside /team but must NOT require team auth.
  // Render its children unwrapped so the public login form can mount.
  if (path === '/team/login' || path.startsWith('/team/login/')) {
    return <>{children}</>
  }

  const session = await requireTeam({ path })
  return <TeamShell session={session}>{children}</TeamShell>
}
