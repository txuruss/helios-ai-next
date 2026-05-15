'use client'

// Self-contained client component for the sidebar unread badge.
// Fetches count on mount, then re-fetches every 30 seconds.
// Silent no-op on error — badge simply stays hidden.

import { useState, useEffect } from 'react'
import { getInboxUnreadCount } from '@/lib/actions/inbox'

export default function InboxUnreadBadge() {
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      try {
        const result = await getInboxUnreadCount()
        if (mounted && !result.error) setCount(result.count)
      } catch { /* silent */ }
    }

    void refresh()
    const timer = setInterval(refresh, 30_000)
    return () => { mounted = false; clearInterval(timer) }
  }, [])

  if (count <= 0) return null

  return (
    <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1
                     rounded-full bg-[#ff7a18] text-[#1a0c00] text-[10px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}
