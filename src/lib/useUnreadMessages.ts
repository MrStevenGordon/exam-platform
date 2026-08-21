'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function useUnreadMessageCount() {
  const pathname = usePathname()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const { data } = await supabase.rpc('get_unread_message_count')
      if (!cancelled) setCount(data || 0)
    }
    refresh()

    const channel = supabase
      .channel('unread-message-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .subscribe()

    // Marking a conversation read happens client-side within the Messages
    // page without a route change or a messages INSERT, so it wouldn't
    // otherwise be caught by either listener above.
    window.addEventListener('unread-messages-changed', refresh)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      window.removeEventListener('unread-messages-changed', refresh)
    }
    // Re-fetch on every route change too, so the badge clears right after
    // the Messages page marks a conversation read.
  }, [pathname])

  return count
}
