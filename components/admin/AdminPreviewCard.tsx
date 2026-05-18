import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Props {
  title:         string
  subtitle?:     string
  href:          string
  hrefLabel?:    string
  legacyHref?:   string
  legacyLabel?:  string
  children:      React.ReactNode
}

// Reusable preview panel used on Mission Control to summarize each section.
// `legacyHref` is for routes that today defer to /dashboard/* logic — surfaces
// the legacy link explicitly so the founder can jump to the working surface.
export default function AdminPreviewCard({
  title, subtitle, href, hrefLabel, legacyHref, legacyLabel, children,
}: Props) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden flex flex-col">
      <header className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-white truncate">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-[#6a6a6e] mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {legacyHref && (
            <Link href={legacyHref}
              className="text-[11px] px-2 py-1 rounded-full border border-white/[0.08] text-[#9a9a9d] hover:text-white hover:bg-white/[0.04] transition-colors">
              {legacyLabel ?? 'Legacy'}
            </Link>
          )}
          <Link href={href}
            className="text-[11.5px] flex items-center gap-1 text-[#ffae3c] hover:text-white transition-colors">
            {hrefLabel ?? 'Open'}
            <ArrowRight size={11} />
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  )
}
