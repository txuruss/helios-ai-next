'use client'

interface Props { code: string }

export default function CopyButton({ code }: Props) {
  return (
    <button
      className="btn-ghost btn-sm mt-3"
      onClick={() => navigator.clipboard?.writeText(code)}
    >
      Copy Code
    </button>
  )
}
