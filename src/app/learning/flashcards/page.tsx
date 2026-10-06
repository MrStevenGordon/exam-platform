'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createDeck } from '@/lib/flashcards'
import { loadDecksResilient, syncFlashcards } from '@/lib/offline/flashcardsOffline'
import { resolveRole } from '@/lib/offline/role'
import { useOnline } from '@/lib/offline/useOnline'
import { LIMITS } from '@/lib/flashcardsPure'
import EmptyState from '@/components/EmptyState'

// A student's own flashcard decks. Nobody else can see them, not even their teachers.
export default function FlashcardsPage() {
  const router = useRouter()
  const [decks, setDecks] = useState<Array<{ id: string; title: string; subject: string | null; total: number; due: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [creating, setCreating] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const online = useOnline()

  useEffect(() => {
    async function load() {
      const who = await resolveRole()
      if (!who) { router.push('/login'); return }
      if (who.role !== 'student') { router.replace('/learning'); return }
      await syncFlashcards()    // send anything answered while offline before reading
      const res = await loadDecksResilient()
      if (res.ok) { setDecks(res.decks); setFromCache(res.fromCache) } else setError('Could not load your decks. Please try again.')
      setLoading(false)
    }
    load()
  }, [router])

  async function create() {
    setCreating(true); setError('')
    const res = await createDeck(title, subject)
    if (!res.ok) { setError(res.error); setCreating(false); return }
    router.push(`/learning/flashcards/${res.id}`)
  }

  if (loading) return <div className="page-container">Loading…</div>

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <h1 className="portal-page-title">My flashcards</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
        Make decks for what you need to remember. Cards you miss come back sooner. Only you can see your decks.
      </p>

      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 16 }}>{error}</p>}
      {fromCache && <p className="banner banner-warning" style={{ marginTop: 16, fontSize: 13 }}>Showing the copy saved on this device. New decks need a connection.</p>}

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 12 }}>New deck</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 220px' }}>
            <label htmlFor="deck-title" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Name</label>
            <input id="deck-title" value={title} maxLength={LIMITS.maxTitle} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cell biology terms" style={{ width: '100%', display: 'block', marginTop: 4 }} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="deck-subject" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subject (optional)</label>
            <input id="deck-subject" value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" style={{ width: '100%', display: 'block', marginTop: 4 }} />
          </div>
          <button type="button" className="btn btn-primary" onClick={create} disabled={creating || !title.trim() || !online}>{creating ? 'Creating…' : 'Create deck'}</button>
        </div>
      </div>

      {decks.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <EmptyState icon="🗂️" title="No decks yet" description="Create your first deck above, then add cards: a question or word on the front, the answer on the back." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {decks.map((d) => (
            <Link key={d.id} href={`/learning/flashcards/${d.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 16, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{d.subject ? `${d.subject} · ` : ''}{d.total} card{d.total === 1 ? '' : 's'}</div>
              </div>
              {d.due > 0 ? <span className="badge badge-warning">{d.due} to study</span> : d.total > 0 ? <span className="badge badge-success">Up to date</span> : <span className="badge badge-default">Empty</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
