interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export default function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-7 flex-wrap">
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <div className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffae3c]">
            <span className="w-[18px] h-px bg-gradient-to-r from-[#ff7a18] to-transparent" />
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-[14px] text-[#9a9a9d] max-w-[620px]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
