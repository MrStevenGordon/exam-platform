'use client'

import { useEffect, useRef, useState } from 'react'
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

  // The realtime handler below needs the *current* path (to know whether a
  // new message's conversation is already on screen), but the path
  // shouldn't be a dependency of the effect that opens the channel --
  // recreating the whole WebSocket subscription on every navigation was
  // pure overhead (this hook runs on every page, in every portal, so that
  // meant a full connection teardown/reopen on every single route change).
  // A ref lets the closure read the latest value without resubscribing.
  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  // Refetch on every route change: this is what actually clears the badge
  // right after the Messages page marks a conversation read, without
  // needing the channel itself to be recreated.
  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_unread_message_count').then(({ data }) => {
      if (!cancelled) setCount(data || 0)
    })
    return () => { cancelled = true }
  }, [pathname])

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const { data } = await supabase.rpc('get_unread_message_count')
      if (!cancelled) setCount(data || 0)
    }

    const channel = supabase
      .channel('unread-message-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        refresh()
        const { data: { user } } = await supabase.auth.getUser()
        const messagesHref = '/' + (pathnameRef.current?.split('/')[1] || '') + '/messages'
        if (user) notify(payload.new as MessageRow, user.id, messagesHref)
      })
      .subscribe()

    // Marking a conversation read happens client-side within the Messages
    // page without a messages INSERT, so it wouldn't otherwise be caught by
    // the listener above.
    window.addEventListener('unread-messages-changed', refresh)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      window.removeEventListener('unread-messages-changed', refresh)
    }
    // Deliberately once per mount (per portal session), not per navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return count
}

// Browsers only honor a permission prompt triggered by a real user gesture,
// so this is called from a click handler (see Sidebar's notification bell)
// rather than automatically on mount. Returns the resolved permission so
// the caller can update its UI from the real outcome instead of guessing
// with a timeout (the native dialog can take longer than any fixed delay
// to resolve).
export async function requestMessageNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}
