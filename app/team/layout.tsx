// Lean Baseline: /team/* is parked. Middleware redirects all /team
// traffic to /dashboard; this layout is a passthrough so the route group
// still type-checks. See docs/PARKED_FEATURES.md.
export default function ParkedTeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
