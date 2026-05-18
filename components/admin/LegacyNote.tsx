import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

interface Props {
  href:    string
  label:   string
  note?:   string
}

// Reusable note shown on admin shell pages that defer to /dashboard/* for real
// data. Surfaces the legacy URL prominently so founders always have a fast
// path to the working surface during the migration period.
export default function LegacyNote({ href, label, note }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 text-[13px] text-[#9a9a9d] flex items-center justify-between gap-3 flex-wrap">
      <span>{note ?? 'This page is currently a scaffold. Working data lives in the legacy dashboard.'}</span>
      <Link href={href} className="flex items-center gap-1.5 text-[#ffae3c] hover:underline">
        {label} <ExternalLink size={12} />
      </Link>
    </div>
  )
}
