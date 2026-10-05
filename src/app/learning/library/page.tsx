'use client'

import { useEffect, useMemo, useState } from 'react'
import BookCard from '@/components/library/BookCard'
import { libraryGet, libraryErrorText, loadMyProgress, SHELF_LABEL, type LibraryBook, type LibraryProgress, type LibraryShelf } from '@/lib/library'

type Tab = 'all' | LibraryShelf

export default function LibraryHome() {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [progress, setProgress] = useState<LibraryProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [subject, setSubject] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [list, mine] = await Promise.all([libraryGet<{ books: LibraryBook[] }>('/api/library/books'), loadMyProgress().catch(() => [] as LibraryProgress[])])
        if (cancelled) return
        setBooks(list.books)
        setProgress(mine)
      } catch (err) {
        if (!cancelled) setError(libraryErrorText(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const term = search.trim().toLowerCase()
  const visible = useMemo(() => books.filter((b) => {
    if (tab !== 'all' && b.shelf !== tab) return false
    if (term && !`${b.title} ${b.author} ${b.subject ?? ''} ${b.topic ?? ''}`.toLowerCase().includes(term)) return false
    return true
  }), [books, tab, term])

  const subjects = useMemo(() => Array.from(new Set(books.filter((b) => b.shelf === 'curriculum' && b.subject).map((b) => b.subject as string))).sort(), [books])
  const curriculum = visible.filter((b) => b.shelf === 'curriculum' && (!subject || b.subject === subject))
  const fun = visible.filter((b) => b.shelf === 'fun')
  const continuing = progress.filter((p) => !p.finished_at && p.percent < 100).slice(0, 8)
  const showContinue = tab === 'all' && !term && continuing.length > 0

  const tabs: Array<{ id: Tab; label: string }> = [{ id: 'all', label: 'All' }, { id: 'curriculum', label: SHELF_LABEL.curriculum }, { id: 'fun', label: SHELF_LABEL.fun }]

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="portal-page-title">Library</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Read it. Listen to it. Pick up where you left off.</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-strong)', background: '#fff', borderRadius: 100, padding: '8px 14px', width: 280, maxWidth: '100%' }}>
          <i className="ti ti-search" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books, authors, topics" aria-label="Search the Library" style={{ border: 0, outline: 'none', background: 'transparent', fontSize: 13, width: '100%', padding: 0 }} />
        </label>
      </div>

      <div className="lib-tabs" role="tablist" aria-label="Shelves">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className="lib-tab" onClick={() => { setTab(t.id); setSubject(null) }}>{t.label}</button>
        ))}
      </div>

      {error && <div className="banner banner-danger" style={{ marginTop: 16 }}>{error}</div>}
      {loading && !error && <p style={{ color: 'var(--text-secondary)', marginTop: 20 }}>Loading the Library…</p>}

      {!loading && !error && books.length === 0 && (
        <div className="card" style={{ marginTop: 20, padding: 24, maxWidth: 520 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>The Library is being stocked</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Books will appear here as they are added. Check back soon.</div>
        </div>
      )}

      {!loading && !error && books.length > 0 && visible.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', marginTop: 20 }}>Nothing matches that search.</p>
      )}

      {showContinue && (
        <>
          <div className="lib-shelf-head"><h2>Continue</h2></div>
          <div className="lib-shelf">
            {continuing.map((p) => (
              <BookCard key={p.book_id} id={p.book_id} title={p.book_title} author={p.book_author} coverBg={p.cover_bg} coverFg={p.cover_fg} percent={p.percent}
                note={p.last_format === 'listen' ? 'Listening' : p.read_pages > 0 ? `Page ${p.read_page} of ${p.read_pages}` : undefined} />
            ))}
          </div>
        </>
      )}

      {curriculum.length > 0 && (tab === 'all' || tab === 'curriculum') && (
        <>
          <div className="lib-shelf-head"><h2>{SHELF_LABEL.curriculum}</h2></div>
          {subjects.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button className="lib-chip" aria-pressed={subject === null} onClick={() => setSubject(null)}>All subjects</button>
              {subjects.map((s) => <button key={s} className="lib-chip" aria-pressed={subject === s} onClick={() => setSubject(subject === s ? null : s)}>{s}</button>)}
            </div>
          )}
          <div className="lib-shelf">
            {curriculum.map((b) => <BookCard key={b.id} id={b.id} title={b.title} author={b.author} coverBg={b.cover_bg} coverFg={b.cover_fg} formats={b.formats} licence={b.licence} />)}
          </div>
        </>
      )}

      {fun.length > 0 && (tab === 'all' || tab === 'fun') && (
        <>
          <div className="lib-shelf-head"><h2>{SHELF_LABEL.fun}</h2></div>
          <div className="lib-shelf">
            {fun.map((b) => <BookCard key={b.id} id={b.id} title={b.title} author={b.author} coverBg={b.cover_bg} coverFg={b.cover_fg} formats={b.formats} licence={b.licence} />)}
          </div>
        </>
      )}
    </div>
  )
}
