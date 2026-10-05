'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import { supabase } from '@/lib/supabase'
import { libraryGet, libraryErrorText, readPercent, saveProgress, type LibraryBook, type LibraryFile } from '@/lib/library'

// Shows one PDF a page at a time and remembers the page. The file is fetched through a short-lived link from the
// server; if that link runs out while someone is reading, "Try again" asks for a fresh one.
const MIN_ZOOM = 0.7
const MAX_ZOOM = 2.2

// A person's own bookmark or note on a page (migration 079). Private to them.
type Note = { id: string; page: number; kind: 'bookmark' | 'note'; body: string | null }

export default function PdfReader({ book, file, startPage }: { book: LibraryBook; file: LibraryFile; startPage: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const renderRef = useRef<RenderTask | null>(null)
  const [pages, setPages] = useState(file.pages ?? 0)
  const [page, setPage] = useState(Math.max(1, startPage))
  const [jump, setJump] = useState('')
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notesOn, setNotesOn] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [userId, setUserId] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [notesError, setNotesError] = useState('')

  // Load the document.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus('loading')
      setError('')
      try {
        const [{ url }, pdfjs] = await Promise.all([libraryGet<{ url: string }>(`/api/library/files/${file.id}/url`), import('pdfjs-dist')])
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const task = pdfjs.getDocument({ url })
        const doc = await task.promise
        if (cancelled) { task.destroy(); return }
        const old = taskRef.current
        taskRef.current = task
        docRef.current = doc
        old?.destroy()
        setPages(doc.numPages)
        setPage((p) => Math.min(Math.max(1, p), doc.numPages))
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(libraryErrorText(err))
        setStatus('error')
      }
    }
    load()
    return () => { cancelled = true }
  }, [file.id, reloadKey])

  useEffect(() => () => { taskRef.current?.destroy(); taskRef.current = null; docRef.current = null }, [])

  // Bookmarks and notes for this file. If migration 079 is not applied the buttons simply do not appear.
  useEffect(() => {
    let cancelled = false
    async function loadNotes() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error: e } = await supabase.from('library_notes').select('id, page, kind, body, file_id').eq('book_id', book.id).order('page')
      if (cancelled) return
      if (e) { setNotesOn(false); return }
      setUserId(user?.id ?? '')
      setNotes(((data || []) as Array<Note & { file_id: string | null }>).filter((n) => !n.file_id || n.file_id === file.id))
      setNotesOn(true)
    }
    loadNotes()
    return () => { cancelled = true }
  }, [book.id, file.id])

  const bookmark = notes.find((n) => n.kind === 'bookmark' && n.page === page)
  const notesError2 = (e: { code?: string; message?: string }) => (e.code === 'P0001' && e.message ? e.message : 'Could not save that. Please try again.')

  async function toggleBookmark() {
    setNotesError('')
    if (bookmark) {
      const { error: e } = await supabase.from('library_notes').delete().eq('id', bookmark.id)
      if (e) { setNotesError(notesError2(e)); return }
      setNotes((all) => all.filter((n) => n.id !== bookmark.id))
      return
    }
    const { data, error: e } = await supabase.from('library_notes').insert({ user_id: userId, book_id: book.id, file_id: file.id, page, kind: 'bookmark' }).select('id, page, kind, body').single()
    if (e || !data) { setNotesError(notesError2(e ?? {})); return }
    setNotes((all) => [...all, data as Note].sort((a, b) => a.page - b.page))
  }

  async function addNote() {
    const body = draft.trim()
    if (!body) return
    setNotesError('')
    const { data, error: e } = await supabase.from('library_notes').insert({ user_id: userId, book_id: book.id, file_id: file.id, page, kind: 'note', body }).select('id, page, kind, body').single()
    if (e || !data) { setNotesError(notesError2(e ?? {})); return }
    setNotes((all) => [...all, data as Note].sort((a, b) => a.page - b.page))
    setDraft('')
  }

  async function removeNote(id: string) {
    setNotesError('')
    const { error: e } = await supabase.from('library_notes').delete().eq('id', id)
    if (e) { setNotesError(notesError2(e)); return }
    setNotes((all) => all.filter((n) => n.id !== id))
  }

  // Keep the page as wide as its space.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Draw the current page.
  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    async function draw() {
      const doc = docRef.current
      const canvas = canvasRef.current
      if (!doc || !canvas) return
      try {
        const pdfPage = await doc.getPage(page)
        if (cancelled) return
        const base = pdfPage.getViewport({ scale: 1 })
        const scale = (Math.max(280, width || 800) / base.width) * zoom
        const dpr = window.devicePixelRatio || 1
        const viewport = pdfPage.getViewport({ scale: scale * dpr })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
        renderRef.current?.cancel()
        const task = pdfPage.render({ canvas, viewport })
        renderRef.current = task
        await task.promise
      } catch (err) {
        if (cancelled || (err as { name?: string })?.name === 'RenderingCancelledException') return
        setError('This page could not be loaded. The link may have expired.')
        setStatus('error')
      }
    }
    draw()
    return () => { cancelled = true; renderRef.current?.cancel() }
  }, [status, page, zoom, width])

  // Remember the page a moment after the person settles on it.
  useEffect(() => {
    if (status !== 'ready' || pages <= 0) return
    const timer = setTimeout(() => {
      saveProgress({ book, format: 'read', fileId: file.id, page, pages, percent: page >= pages ? 100 : readPercent(page, pages) })
    }, 1200)
    return () => clearTimeout(timer)
  }, [status, page, pages, book, file.id])

  const go = (n: number) => setPage(Math.min(Math.max(1, n), Math.max(1, pages)))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, Math.max(1, pages)))
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages])

  return (
    <div className="page-container" style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <Link href={`/learning/library/${book.id}`} className="btn btn-ghost"><i className="ti ti-arrow-left" aria-hidden="true" /> Back</Link>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{book.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{file.label ? `${file.label} · ` : ''}{pages > 0 ? `page ${page} of ${pages}` : 'Loading'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {notesOn && status === 'ready' && (
            <>
              <button className={bookmark ? 'btn btn-primary' : 'btn btn-secondary'} onClick={toggleBookmark} aria-pressed={!!bookmark} aria-label={bookmark ? 'Remove the bookmark from this page' : 'Bookmark this page'}>
                <i className="ti ti-bookmark" aria-hidden="true" /> {bookmark ? 'Bookmarked' : 'Bookmark'}
              </button>
              <button className="btn btn-secondary" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
                <i className="ti ti-note" aria-hidden="true" /> Notes{notes.length > 0 ? ` (${notes.length})` : ''}
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.15).toFixed(2)))} disabled={zoom <= MIN_ZOOM} aria-label="Make the text smaller">A-</button>
          <button className="btn btn-secondary" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.15).toFixed(2)))} disabled={zoom >= MAX_ZOOM} aria-label="Make the text bigger">A+</button>
        </div>
      </div>

      {panelOpen && notesOn && (
        <div className="card" style={{ marginTop: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Your notes on this book</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Only you can see these.</div>
          {notesError && <div className="banner banner-danger" style={{ marginBottom: 10 }} role="alert">{notesError}</div>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder={`A note for page ${page}`} aria-label={`A note for page ${page}`} style={{ flex: 1, minWidth: 220, minHeight: 56 }} />
            <button className="btn btn-primary" onClick={addNote} disabled={!draft.trim()} style={{ alignSelf: 'flex-end' }}>Save note</button>
          </div>
          {notes.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No bookmarks or notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <i className={`ti ${n.kind === 'bookmark' ? 'ti-bookmark' : 'ti-note'}`} aria-hidden="true" style={{ color: 'var(--accent)', marginTop: 2 }} />
              <button onClick={() => go(n.page)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--accent-dark)', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Page {n.page}</button>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{n.kind === 'bookmark' ? 'Bookmark' : n.body}</div>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => removeNote(n.id)} aria-label={`Delete the ${n.kind} on page ${n.page}`}><i className="ti ti-trash" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="banner banner-danger" style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{error}</span>
          <button className="btn btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </div>
      )}
      {status === 'loading' && <p style={{ color: 'var(--text-secondary)', marginTop: 20 }}>Opening the book…</p>}

      <div ref={wrapRef} style={{ marginTop: 16, overflowX: 'auto', display: status === 'error' ? 'none' : 'block' }}>
        <canvas ref={canvasRef} aria-label={`Page ${page} of ${book.title}`} style={{ display: status === 'ready' ? 'block' : 'none', margin: '0 auto', background: '#fff', boxShadow: 'var(--shadow-card)', borderRadius: 4 }} />
      </div>

      {status === 'ready' && pages > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => go(page - 1)} disabled={page <= 1}><i className="ti ti-chevron-left" aria-hidden="true" /> Previous</button>
          <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(jump, 10); if (Number.isFinite(n)) go(n); setJump('') }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="lib-jump" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Go to page</label>
            <input id="lib-jump" value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder={String(page)} style={{ width: 64, padding: '6px 8px', textAlign: 'center' }} />
          </form>
          <button className="btn btn-secondary" onClick={() => go(page + 1)} disabled={page >= pages}>Next <i className="ti ti-chevron-right" aria-hidden="true" /></button>
        </div>
      )}
      <div className="lib-prog" style={{ maxWidth: 720, margin: '16px auto 0' }}><span style={{ width: `${pages > 0 ? readPercent(page, pages) : 0}%` }} /></div>
    </div>
  )
}
