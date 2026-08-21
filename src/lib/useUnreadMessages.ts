'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type MessageRow = { id: string; conversation_id: string; sender_id: string; body: string }

const senderNameCache = new Map<string, string>()

async function resolveSenderName(senderId: string): Promise<string> {
  const cached = senderNameCache.get(senderId)
  if (cached) return cached
  const { data } = await supabase.from('profiles').select('full_name').eq('id', senderId).single()
  const name = data?.full_name || 'Someone'
  senderNameCache.set(senderId, name)
  return name
}

// Native browser notification for a new message, shown only when the user
// isn't already looking at the relevant Messages page. Requires the
// notification permission the caller requests separately (see
// requestMessageNotificationPermission) — silently does nothing without it.
async function notify(msg: MessageRow, myId: string, messagesHref: string) {
  if (msg.sender_id === myId) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const alreadyOnMessages = !document.hidden && window.location.pathname === messagesHref
  if (alreadyOnMessages) return

  const senderName = await resolveSenderName(msg.sender_id)
  const n = new Notification(senderName, { body: msg.body, tag: msg.conversation_id })
  n.onclick = () => {
    window.focus()
    window.location.href = messagesHref
  }
}

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

    const messagesHref = '/' + (pathname?.split('/')[1] || '') + '/messages'

    const channel = supabase
      .channel('unread-message-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        refresh()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) notify(payload.new as MessageRow, user.id, messagesHref)
      })
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

// Browsers only honor a permission prompt triggered by a real user gesture,
// so this is called from a click handler (see Sidebar's notification bell)
// rather than automatically on mount.
export function requestMessageNotificationPermission() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') Notification.requestPermission()
}
