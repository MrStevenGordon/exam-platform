'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { addCards, deleteCard, deleteDeck, loadDeck, renameDeck, updateCard, type Deck } from '@/lib/flashcards'
import { checkCard, deckStats, LIMITS, parseBulk, type Card } from '@/lib/flashcardsPure'

// One deck: its cards (add, edit, delete, paste many at once), how well it is known, and the Study button.
export default function DeckPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [bulk, setBulk] = useState('')
  const [editing, setEditing] = useState<{ id: string; front: string; back: string } | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const apply = useCallback((res: Awaited<ReturnType<typeof loadDeck>>) => {
    if (!res.ok) { setError(res.notFound ? 'This deck was not found.' : 'Could not load this deck. Please try again.'); setLoading(false); return }
    setDeck(res.deck); setCards(res.cards); setTitle(res.deck.title); setLoading(false)
  }, [])
  const refresh = useCallback(async () => { apply(await loadDeck(id)) }, [apply, id])
  useEffect(() => {
    let cancelled = false
    loadDeck(id).then((res) => { if (!cancelled) apply(res) })
    return () => { cancelled = true }
  }, [id, apply])

  const now = new Date()
  const stats = deckStats(cards, now)

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done?: string) {
    setBusy(true); setError(''); setNotice('')
    const res = await fn()
    if (!res.ok) setError(res.error); else { if (done) setNotice(done); await refresh() }
    setBusy(false)
    return res.ok
  }

  async function addOne() {
    const problem = checkCard(front, back)
    if (problem) { setError(problem); return }
    if (await run(() => addCards(id, [{ front, back }]))) { setFront(''); setBack('') }
  }

  async function addMany() {
    const parsed = parseBulk(bulk, LIMITS.maxCards - cards.length)
    if (parsed.cards.length === 0) { setError('No cards found. Put one card on each line, with the front and back separated by | (a vertical bar) or a tab.'); return }
    const extra = [parsed.skipped ? `${parsed.skipped} line${parsed.skipped === 1 ? ' was' : 's were'} skipped` : '', parsed.tooLong ? `${parsed.tooLong} too long` : ''].filter(Boolean).join(', ')
    if (await run(() => addCards(id, parsed.cards), `Added ${parsed.cards.length} card${parsed.cards.length === 1 ? '' : 's'}.${extra ? ` ${extra}.` : ''}`)) setBulk('')
  }

  async function removeDeck() {
    if (!window.confirm('Delete this whole deck and all its cards? This cannot be undone.')) return
    setBusy(true)
    const res = await deleteDeck(id)
    if (!res.ok) { setError(res.error); setBusy(false); return }
    router.push('/learning/flashcards')
  }

  if (loading) return <div className="page-container">Loading…</div>
  if (!deck) return <div className="page-container"><Link href="/learning/flashcards" style={{ fontSize: 14 }}>&larr; My flashcards</Link><p role="alert" className="banner banner-danger" style={{ marginTop: 16 }}>{error}</p></div>

  const field = { width: '100%', display: 'block', marginTop: 4 } as const
  const lab = { fontSize: 13, color: 'var(--text-secondary)' } as const

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <Link href="/learning/flashcards" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>&larr; My flashcards</Link>
      <h1 className="portal-page-title" style={{ marginTop: 16 }}>{deck.title}</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{deck.subject ? `${deck.subject} · ` : ''}{stats.total} card{stats.total === 1 ? '' : 's'}</p>

      {error && <p role="alert" className="banner banner-danger" style={{ marginTop: 16 }}>{error}</p>}
      {notice && <p role="status" className="banner banner-success" style={{ marginTop: 16 }}>{notice}</p>}

      {stats.total > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><strong style={{ fontSize: 22 }}>{stats.due}</strong><div style={lab}>to study now</div></div>
            <div><strong style={{ fontSize: 22 }}>{stats.fresh}</strong><div style={lab}>new</div></div>
            <div><strong style={{ fontSize: 22 }}>{stats.learning}</strong><div style={lab}>still learning</div></div>
            <div><strong style={{ fontSize: 22 }}>{stats.known}</strong><div style={lab}>known well</div></div>
            <span style={{ flex: 1 }} />
            {stats.due > 0
              ? <Link href={`/learning/flashcards/${id}/study`} className="btn btn-primary">Study {Math.min(stats.due, LIMITS.sessionSize)} card{Math.min(stats.due, LIMITS.sessionSize) === 1 ? '' : 's'}</Link>
              : <span className="badge badge-success">Nothing due. Come back later.</span>}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Add a card</h2>
        <label htmlFor="front" style={lab}>Front (the question or word)</label>
        <textarea id="front" value={front} rows={2} maxLength={LIMITS.maxFront} onChange={(e) => setFront(e.target.value)} style={field} />
        <label htmlFor="back" style={{ ...lab, display: 'block', marginTop: 10 }}>Back (the answer)</label>
        <textarea id="back" value={back} rows={2} maxLength={LIMITS.maxBack} onChange={(e) => setBack(e.target.value)} style={field} />
        <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={addOne} disabled={busy || !front.trim() || !back.trim() || cards.length >= LIMITS.maxCards}>Add card</button>

        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Add many cards at once</summary>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0' }}>One card on each line. Write the front, then a | (vertical bar), then the back. Example: <code>Photosynthesis | How plants make food using light</code></p>
          <textarea aria-label="Cards to add, one per line" value={bulk} rows={6} onChange={(e) => setBulk(e.target.value)} style={field} />
          <button type="button" className="btn btn-secondary" style={{ marginTop: 10 }} onClick={addMany} disabled={busy || !bulk.trim()}>Add these cards</button>
        </details>
      </div>

      {cards.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Cards</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cards.map((c) => (
              <div key={c.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                {editing?.id === c.id ? (
                  <div>
                    <label htmlFor={`ef-${c.id}`} style={lab}>Front</label>
                    <textarea id={`ef-${c.id}`} value={editing.front} rows={2} maxLength={LIMITS.maxFront} onChange={(e) => setEditing({ ...editing, front: e.target.value })} style={field} />
                    <label htmlFor={`eb-${c.id}`} style={{ ...lab, display: 'block', marginTop: 8 }}>Back</label>
                    <textarea id={`eb-${c.id}`} value={editing.back} rows={2} maxLength={LIMITS.maxBack} onChange={(e) => setEditing({ ...editing, back: e.target.value })} style={field} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" className="btn btn-primary" style={{ fontSize: 13, padding: '5px 12px' }} disabled={busy} onClick={async () => { if (await run(() => updateCard(c.id, editing.front, editing.back))) setEditing(null) }}>Save</button>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>{c.front}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, overflowWrap: 'anywhere' }}>{c.back}</div>
                    </div>
                    <span className="badge badge-default" title="How well you know this card">{c.timesSeen === 0 ? 'New' : c.box === 5 ? 'Known' : `Box ${c.box}`}</span>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing({ id: c.id, front: c.front, back: c.back })}>Edit</button>
                    <button type="button" aria-label={`Delete card ${c.front}`} onClick={() => run(() => deleteCard(c.id))} disabled={busy} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 12 }}>Deck settings</h2>
        <label htmlFor="rename" style={lab}>Name</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input id="rename" value={title} maxLength={LIMITS.maxTitle} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
          <button type="button" className="btn btn-secondary" disabled={busy || !title.trim() || title.trim() === deck.title} onClick={() => run(() => renameDeck(id, title), 'Renamed.')}>Rename</button>
        </div>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 14, color: 'var(--danger)' }} onClick={removeDeck} disabled={busy}>Delete this deck</button>
      </div>
    </div>
  )
}
