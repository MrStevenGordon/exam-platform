'use client'

import { useCallback, useEffect, useState } from 'react'
import { announceQueueChange, QUEUE_EVENT, useOnline } from '@/lib/offline/useOnline'
import { pendingFlashcardAnswers, syncFlashcards } from '@/lib/offline/flashcardsOffline'

// Tells a student where they stand: offline (and what still works), or that answers saved while offline are being sent. Shown at the top of
// Smart Learning for students; shows nothing at all when everything is normal.
export default function OfflineBanner() {
  const online = useOnline()
  const [pending, setPending] = useState(0)
  const [sentNote, setSentNote] = useState('')

  const refresh = useCallback(async () => { setPending(await pendingFlashcardAnswers()) }, [])
  useEffect(() => {
    const t = setTimeout(refresh, 0)
    window.addEventListener(QUEUE_EVENT, refresh)
    return () => { clearTimeout(t); window.removeEventListener(QUEUE_EVENT, refresh) }
  }, [refresh])

  // Back online: send what was saved while offline.
  useEffect(() => {
    if (!online) return
    let cancelled = false
    async function send() {
      const r = await syncFlashcards()
      if (cancelled || !r) return
      await refresh()
      announceQueueChange()
      if (r.sent > 0) { setSentNote(`Your ${r.sent} saved flashcard answer${r.sent === 1 ? ' was' : 's were'} sent.`); setTimeout(() => setSentNote(''), 6000) }
    }
    send()
    return () => { cancelled = true }
  }, [online, refresh])

  if (!online) {
    return (
      <div role="status" aria-live="polite" className="banner banner-warning" style={{ margin: '0 0 12px', fontSize: 13 }}>
        <strong>You are offline.</strong> You can study flashcards and read lessons you have opened before. Your flashcard answers are saved on this device and sent when you reconnect.
        {pending > 0 ? ` ${pending} answer${pending === 1 ? ' is' : 's are'} waiting to be sent.` : ''}
      </div>
    )
  }
  if (pending > 0) return <div role="status" aria-live="polite" className="banner banner-warning" style={{ margin: '0 0 12px', fontSize: 13 }}>Sending your saved flashcard answers…</div>
  if (sentNote) return <div role="status" aria-live="polite" className="banner banner-success" style={{ margin: '0 0 12px', fontSize: 13 }}>{sentNote}</div>
  return null
}
