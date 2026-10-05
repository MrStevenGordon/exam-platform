'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import { libraryGet, libraryErrorText, readPercent, saveProgress, type LibraryBook, type LibraryFile } from '@/lib/library'

// Shows one PDF a page at a time and remembers the page. The file is fetched through a short-lived link from the
// server; if that link runs out while someone is reading, "Try again" asks for a fresh one.
const MIN_ZOOM = 0.7
const MAX_ZOOM = 2.2

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
          <button className="btn btn-secondary" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.15).toFixed(2)))} disabled={zoom <= MIN_ZOOM} aria-label="Make the text smaller">A-</button>
          <button className="btn btn-secondary" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.15).toFixed(2)))} disabled={zoom >= MAX_ZOOM} aria-label="Make the text bigger">A+</button>
        </div>
      </div>

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
