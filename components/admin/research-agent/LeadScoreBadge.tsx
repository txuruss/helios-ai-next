'use client'

import { scoreBand } from '@/lib/research/leadScoring'

// Compact 0–100 fit-score pill, colored by band. Matches the Mission
// Control palette used across the admin tables.
export default function LeadScoreBadge({ score, showLabel = false }: { score: number; showLabel?: boolean }) {
  const band = scoreBand(score)
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-[3px] rounded-full border whitespace-nowrap tabular-nums"
      style={{ color: band.color, borderColor: `${band.color}33`, background: `${band.color}12` }}
    >
      {score}
      <span className="text-[9.5px] font-normal opacity-70">/100</span>
      {showLabel && <span className="font-normal opacity-80">· {band.label}</span>}
    </span>
  )
}
