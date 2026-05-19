// Lean Baseline: /client/* is parked. Middleware redirects all /client
// traffic to /dashboard; this layout is a passthrough so the route group
// still type-checks. See docs/PARKED_FEATURES.md.
export default function ParkedClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
