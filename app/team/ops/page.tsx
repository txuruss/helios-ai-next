import { redirect } from 'next/navigation'

// /team/ops is the canonical post-login landing path for team_* roles
// (per lib/auth/post-login-redirect.ts → TEAM_HOME).
//
// For now it redirects to the existing /team/dashboard, which is the
// real team workspace today. When the full /team/ops UI is built, this
// page will be replaced — every link and redirect that targets /team/ops
// already points at the right URL, so no broader cleanup will be needed.
//
// The /team layout (`app/team/layout.tsx`) authenticates this route via
// requireTeam(), so unauthenticated visitors are redirected to
// /team/login before this redirect fires.
export default function TeamOpsIndex() {
  redirect('/team/dashboard')
}
