import { cn } from './cn'
import type { LucideIcon } from 'lucide-react'

export type IconVariant = 'gold' | 'orange' | 'blue' | 'green' | 'danger' | 'neutral'
export type IconSize = 'sm' | 'md' | 'lg' | 'xl'

const variantClasses: Record<IconVariant, string> = {
  gold:    'text-[#f5b942] border-[#f5b942]/[0.22] bg-[#f5b942]/[0.08]',
  orange:  'text-[#fb923c] border-[#fb923c]/[0.22] bg-[#fb923c]/[0.08]',
  blue:    'text-[#6db4ff] border-[#6db4ff]/[0.22] bg-[#6db4ff]/[0.08]',
  green:   'text-[#34d399] border-[#34d399]/[0.22] bg-[#34d399]/[0.08]',
  danger:  'text-[#f87171] border-[#f87171]/[0.22] bg-[#f87171]/[0.08]',
  neutral: 'text-[#cfd3dc] border-white/[0.10]     bg-white/[0.04]',
}

const glowClasses: Record<IconVariant, string> = {
  gold:    'shadow-[0_6px_24px_-8px_rgba(245,185,66,0.35)]',
  orange:  'shadow-[0_6px_24px_-8px_rgba(249,115,22,0.35)]',
  blue:    'shadow-[0_6px_24px_-8px_rgba(109,180,255,0.30)]',
  green:   'shadow-[0_6px_24px_-8px_rgba(52,211,153,0.30)]',
  danger:  'shadow-[0_6px_24px_-8px_rgba(248,113,113,0.30)]',
  neutral: 'shadow-[0_6px_24px_-8px_rgba(255,255,255,0.10)]',
}

const sizeClasses: Record<IconSize, { box: string; px: number }> = {
  sm: { box: 'w-7 h-7 rounded-lg',    px: 13 },
  md: { box: 'w-9 h-9 rounded-xl',    px: 16 },
  lg: { box: 'w-11 h-11 rounded-xl',  px: 20 },
  xl: { box: 'w-14 h-14 rounded-2xl', px: 24 },
}

interface IconBadgeProps {
  icon: LucideIcon
  variant?: IconVariant
  size?: IconSize
  glow?: boolean
  className?: string
}

export function IconBadge({
  icon: Icon,
  variant = 'gold',
  size = 'md',
  glow = false,
  className,
}: IconBadgeProps) {
  const { box, px } = sizeClasses[size]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center shrink-0 border transition-all duration-300',
        box,
        variantClasses[variant],
        glow && glowClasses[variant],
        className,
      )}
    >
      <Icon size={px} strokeWidth={1.75} />
    </span>
  )
}
