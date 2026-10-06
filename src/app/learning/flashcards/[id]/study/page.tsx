'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { loadDeckResilient, recordReviewResilient, syncFlashcards } from '@/lib/offline/flashcardsOffline'
import { announceQueueChange } from '@/lib/offline/useOnline'
import { answer, current, dueCards, finished, nextDue, startSession, summary, LIMITS, type Card, type Session } from '@/lib/flashcardsPure'

// A study round: a card shows its front, the student flips it, then says "Got it" or "Not yet". Missed cards come back later in
// the same round (up to twice) and are scheduled sooner. Every answer is saved as it is given, so closing the page loses nothing.
export default function StudyPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [title, setTitle] = useState('')
  const [all, setAll] = useState<Card[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [byId, setById] = useState<Record<string, Card>>({})
  const [shown, setShown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [savedOffline, setSavedOffline] = useState(0)
  const [total, setTotal] = useState(0)
  const flipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    syncFlashcards().then(() => loadDeckResilient(id)).then((res) => {
      if (cancelled) return
      if (!res.ok) { setError(res.notFound ? 'This deck was not found.' : 'Could not load this deck. Please try again.'); setLoading(false); return }
      const due = dueCards(res.cards, new Date())
      setTitle(res.deck.title); setAll(res.cards); setTotal(due.length)
      setById(Object.fromEntries(res.cards.map((c) => [c.id, c])))
      setSession(startSession(due)); setLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  async function respond(knewIt: boolean) {
    if (!session) return
    const cardId = current(session)
    if (!cardId) return
    const card = byId[cardId]
    setShown(false)
    setSession(answer(session, knewIt))
    // The card's own saved state moves on with each answer, so a card missed twice in one round is still counted twice.
    const res = await recordReviewResilient(card, knewIt, id)
    if (!res.ok) setSaveError(true)
    else { if (res.queued) { setSavedOffline((n) => n + 1); announceQueueChange() }
    setById((m) => ({ ...m, [cardId]: { ...card, box: knewIt ? Math.min(5, card.box + 1) : 1, timesSeen: card.timesSeen + 1, timesCorrect: card.timesCorrect + (knewIt ? 1 : 0) } })) }
  }

  useEffect(() => { if (!shown) flipRef.current?.focus() }, [shown, session])

  if (loading) return <div className="page-container">Loading…</div>
  const back = <Link href={`/learning/flashcards/${id}`} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; Back to the deck</Link>
  if (error || !session) return <div className="page-container">{back}<p role="alert" className="banner banner-danger" style={{ marginTop: 16 }}>{error}</p></div>

  if (total === 0) {
    const later = nextDue(all, new Date())
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        {back}
        <h1 className="portal-page-title" style={{ marginTop: 16 }}>{title}</h1>
        <p className="banner banner-success" style={{ marginTop: 16 }}>Nothing is due right now.{later ? ` Your next card is ready on ${later.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}.` : ' Add some cards to start.'}</p>
      </div>
    )
  }

  if (finished(session)) {
    const s = summary(session)
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        {back}
        <h1 className="portal-page-title" style={{ marginTop: 16 }}>Round finished</h1>
        <div className="card" style={{ marginTop: 20 }}>
          <p style={{ fontSize: 18, margin: 0 }}><strong>{s.knewFirstTime}</strong> of {s.cards} card{s.cards === 1 ? '' : 's'} known first time.</p>
          {s.needMorePractice > 0 && <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0' }}>{s.needMorePractice} will come back sooner so you can practise them.</p>}
          {saveError && <p role="alert" className="banner banner-warning" style={{ marginTop: 12 }}>Some answers could not be saved. Check your connection.</p>}
          {savedOffline > 0 && <p role="status" className="banner banner-warning" style={{ marginTop: 12 }}>{savedOffline} answer{savedOffline === 1 ? ' is' : 's are'} saved on this device and will be sent when you are back online.</p>}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Link href={`/learning/flashcards/${id}`} className="btn btn-primary">Back to the deck</Link>
          <Link href="/learning/flashcards" className="btn btn-ghost">My flashcards</Link>
        </div>
      </div>
    )
  }

  const card = byId[current(session)!]
  const left = session.queue.length
  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      {back}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>{title}</h1>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{left} to go</span>
      </div>
      <div className="card" aria-live="polite" style={{ marginTop: 20, minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)' }}>{shown ? 'Answer' : 'Question'}</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 10, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{shown ? card.back : card.front}</div>
        {shown && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 14, overflowWrap: 'anywhere' }}>{card.front}</div>}
      </div>
      {!shown ? (
        <button ref={flipRef} type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => setShown(true)}>Show answer</button>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => respond(false)}>Not yet</button>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} autoFocus onClick={() => respond(true)}>Got it</button>
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>A round is at most {LIMITS.sessionSize} cards. Be honest: cards you miss come back sooner, which is how they stick.</p>
      {saveError && <p role="alert" className="banner banner-warning" style={{ marginTop: 12 }}>An answer could not be saved. Check your connection.</p>}
      {savedOffline > 0 && <p role="status" className="banner banner-warning" style={{ marginTop: 12, fontSize: 13 }}>Saved on this device. It will be sent when you are back online.</p>}
    </div>
  )
}
