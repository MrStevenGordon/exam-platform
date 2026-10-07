'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LICENCE_LABEL, LEVEL_LABEL, SHELF_LABEL, formatDuration } from '@/lib/library'
import { GENRES, GENRE_LABEL } from '@/lib/libraryBrowsePure'

type Book = {
  id: string; title: string; author: string; description: string | null; shelf: 'curriculum' | 'fun'; subject: string | null; genre?: string | null; topic: string | null
  levels: string[]; licence: string; licence_note: string | null; source_url: string | null; attribution: string | null
  cover_bg: string; cover_fg: string; status: 'draft' | 'needs_review' | 'published'; rights_confirmed: boolean; files?: { pdf: number; audio: number }
}
type FileRow = { id: string; book_id: string; kind: 'pdf' | 'audio'; label: string; position: number; bytes: number | null; pages: number | null; duration_seconds: number | null }
type Form = Omit<Book, 'id' | 'status' | 'files'>

const EMPTY: Form = { title: '', author: '', description: '', shelf: 'fun', subject: '', genre: '', topic: '', levels: ['forms_1_3', 'forms_4_5', 'sixth_form'], licence: 'public_domain', licence_note: '', source_url: '', attribution: '', cover_bg: '#1E1208', cover_fg: '#F6EDE0', rights_confirmed: false }
const STATUS_BADGE = { draft: 'badge-default', needs_review: 'badge-warning', published: 'badge-success' } as const
const STATUS_LABEL = { draft: 'Draft', needs_review: 'Needs review', published: 'Published' } as const
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }
const fieldStyle: React.CSSProperties = { width: '100%', fontWeight: 400, textTransform: 'none' }

async function token(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${await token()}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || 'Something went wrong.')
  return body as T
}

// What the browser can learn about a file before it is uploaded: a PDF's page count, or an audio file's length.
async function readPdfPages(file: File): Promise<number | null> {
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    const doc = await task.promise
    const pages = doc.numPages
    task.destroy()
    return pages
  } catch { return null }
}
function readAudioSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v) }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null)
    audio.onerror = () => done(null)
    audio.src = url
  })
}

// Same request storage-js makes for a signed upload, so a large file goes straight to storage.
async function uploadToSignedUrl(signedUrl: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('cacheControl', '3600')
  form.append('', file)
  const key = process.env.NEXT_PUBLIC_LIBRARY_SUPABASE_PUBLISHABLE_KEY
  const res = await fetch(signedUrl, { method: 'PUT', body: form, headers: { 'x-upsert': 'false', ...(key ? { apikey: key, Authorization: `Bearer ${key}` } : {}) } })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || body?.error || `The upload was refused (${res.status}).`)
  }
}

export default function OwnerLibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [files, setFiles] = useState<FileRow[]>([])
  const [status, setStatus] = useState<Book['status']>('draft')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState('')
  const [tick, setTick] = useState(0)
  const [notConfigured, setNotConfigured] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api<{ books: Book[] }>('/api/owner/library/books')
        if (!cancelled) { setBooks(res.books); setNotConfigured(false) }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Could not load the catalog.'
        setError(message)
        setNotConfigured(/not connected/i.test(message))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  useEffect(() => {
    if (!selected || selected === 'new') return
    let cancelled = false
    async function open() {
      try {
        const res = await api<{ book: Book; files: FileRow[] }>(`/api/owner/library/books/${selected}`)
        if (cancelled) return
        const { id: _id, status: s, files: _f, ...rest } = res.book
        void _id; void _f
        setForm({ ...EMPTY, ...rest, description: rest.description ?? '', subject: rest.subject ?? '', topic: rest.topic ?? '', licence_note: rest.licence_note ?? '', source_url: rest.source_url ?? '', attribution: rest.attribution ?? '' })
        setStatus(s)
        setFiles(res.files)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open that book.')
      }
    }
    open()
    return () => { cancelled = true }
  }, [selected, tick])

  const reload = () => setTick((n) => n + 1)
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggleLevel = (l: string) => set('levels', form.levels.includes(l) ? form.levels.filter((x) => x !== l) : [...form.levels, l])

  function startNew() { setSelected('new'); setForm(EMPTY); setFiles([]); setStatus('draft'); setNotice(''); setError('') }

  async function save() {
    setBusy(true); setError(''); setNotice('')
    try {
      // The genre is only sent when there is one, or to clear one that was set, so saving still works before central migration 002 is applied.
      const { genre, ...rest } = form
      const hadGenre = !!books.find((b) => b.id === selected)?.genre
      const body = JSON.stringify({ ...rest, ...(genre ? { genre } : hadGenre ? { genre: null } : {}) })
      if (selected === 'new') {
        const res = await api<{ book: Book }>('/api/owner/library/books', { method: 'POST', body })
        setSelected(res.book.id)
        setNotice('Saved as a draft. Now add its files.')
      } else {
        await api(`/api/owner/library/books/${selected}`, { method: 'PUT', body })
        setNotice('Saved.')
      }
      reload()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save.') }
    setBusy(false)
  }

  async function changeStatus(next: Book['status']) {
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/api/owner/library/books/${selected}/status`, { method: 'POST', body: JSON.stringify({ status: next }) })
      setNotice(next === 'published' ? 'Published. Students can see it.' : 'Withdrawn from students.')
      reload()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change the status.') }
    setBusy(false)
  }

  async function remove() {
    if (!confirm(`Delete "${form.title}" and all its files? This cannot be undone.`)) return
    setBusy(true); setError('')
    try {
      await api(`/api/owner/library/books/${selected}`, { method: 'DELETE' })
      setSelected(null); setNotice('Deleted.'); reload()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete.') }
    setBusy(false)
  }

  async function addFiles(list: FileList | null, kind: 'pdf' | 'audio') {
    if (!list || list.length === 0 || !selected || selected === 'new') return
    setError(''); setNotice('')
    const chosen = Array.from(list).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    const start = files.filter((f) => f.kind === kind).length
    for (let i = 0; i < chosen.length; i++) {
      const f = chosen[i]
      setUploading(`Uploading ${f.name} (${i + 1} of ${chosen.length})…`)
      let created: { id: string } | null = null
      try {
        const label = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
        const res = await api<{ file: FileRow; upload: { signedUrl: string } }>(`/api/owner/library/books/${selected}/files`, {
          method: 'POST', body: JSON.stringify({ kind, label, position: start + i, contentType: f.type || (kind === 'pdf' ? 'application/pdf' : ''), bytes: f.size }),
        })
        created = res.file
        await uploadToSignedUrl(res.upload.signedUrl, f)
        const [pages, seconds] = await Promise.all([kind === 'pdf' ? readPdfPages(f) : Promise.resolve(null), kind === 'audio' ? readAudioSeconds(f) : Promise.resolve(null)])
        await api(`/api/owner/library/files/${res.file.id}`, { method: 'PATCH', body: JSON.stringify({ pages, duration_seconds: seconds }) })
      } catch (err) {
        if (created) await api(`/api/owner/library/files/${created.id}`, { method: 'DELETE' }).catch(() => {})
        setError(`${f.name}: ${err instanceof Error ? err.message : 'the upload failed.'}`)
        break
      }
    }
    setUploading('')
    reload()
  }

  async function removeFile(id: string) {
    if (!confirm('Delete this file?')) return
    try { await api(`/api/owner/library/files/${id}`, { method: 'DELETE' }); reload() } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete the file.') }
  }

  async function renameFile(f: FileRow, label: string) {
    if (label === f.label) return
    try { await api(`/api/owner/library/files/${f.id}`, { method: 'PATCH', body: JSON.stringify({ label }) }); reload() } catch (err) { setError(err instanceof Error ? err.message : 'Could not rename the file.') }
  }

  const canPublish = form.rights_confirmed && files.length > 0
  const editing = selected && selected !== 'new'

  return (
    <div className="page-container" style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="portal-page-title">Library catalog</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', maxWidth: 560 }}>Books are added here once and every school with the Library switched on can use them. A book is only visible to students when it is published.</p>
        </div>
        <button className="btn btn-primary" onClick={startNew} disabled={notConfigured}><i className="ti ti-plus" aria-hidden="true" /> Add a book</button>
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="banner banner-success" style={{ marginBottom: 16 }}>{notice}</div>}
      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>}

      {!loading && !notConfigured && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: '1 1 480px', padding: '6px 8px', overflowX: 'auto' }}>
            {books.length === 0 ? <p style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>No books yet. Add the first one.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Title', 'Licence', 'Files', 'Shelf', 'Status'].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {books.map((b) => (
                    <tr key={b.id} onClick={() => { setSelected(b.id); setNotice(''); setError('') }} style={{ cursor: 'pointer', background: selected === b.id ? 'var(--accent-light)' : undefined }}>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{b.title}<div style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>{b.author}</div></td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{LICENCE_LABEL[b.licence] || b.licence}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{b.files ? `${b.files.pdf} text, ${b.files.audio} audio` : ''}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{SHELF_LABEL[b.shelf]}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}><span className={`badge ${STATUS_BADGE[b.status]}`}>{STATUS_LABEL[b.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selected && (
            <div className="card" style={{ flex: '0 1 420px', padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{selected === 'new' ? 'Add a book' : form.title || 'Edit book'}</div>
              <label style={labelStyle}>Title<input value={form.title} onChange={(e) => set('title', e.target.value)} style={fieldStyle} maxLength={200} /></label>
              <label style={labelStyle}>Author<input value={form.author} onChange={(e) => set('author', e.target.value)} style={fieldStyle} maxLength={200} /></label>
              <label style={labelStyle}>Description<textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} style={{ ...fieldStyle, minHeight: 70 }} maxLength={2000} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={labelStyle}>Shelf<select value={form.shelf} onChange={(e) => set('shelf', e.target.value as Form['shelf'])} style={fieldStyle}><option value="curriculum">Curriculum</option><option value="fun">Read for fun</option></select></label>
                <label style={labelStyle}>Subject<input value={form.subject ?? ''} onChange={(e) => set('subject', e.target.value)} style={fieldStyle} maxLength={100} placeholder="English" /></label>
              </div>
              <label style={labelStyle}>Genre<select value={form.genre ?? ''} onChange={(e) => set('genre', e.target.value)} style={fieldStyle}><option value="">Not yet sorted</option>{GENRES.map((g) => <option key={g} value={g}>{GENRE_LABEL[g]}</option>)}</select></label>
              <label style={labelStyle}>Topic<input value={form.topic ?? ''} onChange={(e) => set('topic', e.target.value)} style={fieldStyle} maxLength={100} placeholder="Tragedy" /></label>
              <div style={{ ...labelStyle, gap: 6 }}>Levels
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', textTransform: 'none', fontWeight: 400, fontSize: 13 }}>
                  {Object.entries(LEVEL_LABEL).map(([k, v]) => <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={form.levels.includes(k)} onChange={() => toggleLevel(k)} />{v}</label>)}
                </div>
              </div>
              <label style={labelStyle}>Licence<select value={form.licence} onChange={(e) => set('licence', e.target.value)} style={fieldStyle}>{Object.entries(LICENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label style={labelStyle}>Source (web address)<input value={form.source_url ?? ''} onChange={(e) => set('source_url', e.target.value)} style={fieldStyle} placeholder="https://" maxLength={1000} /></label>
              <label style={labelStyle}>Credit line<input value={form.attribution ?? ''} onChange={(e) => set('attribution', e.target.value)} style={fieldStyle} maxLength={500} placeholder="Text from Project Gutenberg. Audio by LibriVox volunteers." /></label>
              <label style={labelStyle}>Licence note<input value={form.licence_note ?? ''} onChange={(e) => set('licence_note', e.target.value)} style={fieldStyle} maxLength={500} /></label>
              <div style={{ display: 'flex', gap: 14, marginBottom: 12, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Cover <input type="color" value={form.cover_bg} onChange={(e) => set('cover_bg', e.target.value.toUpperCase())} aria-label="Cover colour" /></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Text <input type="color" value={form.cover_fg} onChange={(e) => set('cover_fg', e.target.value.toUpperCase())} aria-label="Cover text colour" /></label>
                <div style={{ width: 44, height: 62, borderRadius: 3, background: form.cover_bg, color: form.cover_fg, fontSize: 8, padding: 4, boxSizing: 'border-box', fontFamily: 'Fraunces, serif', display: 'flex', alignItems: 'flex-end', textTransform: 'none' }} aria-hidden="true">{form.title.slice(0, 18)}</div>
              </div>
              <div className="banner banner-warning" style={{ fontSize: 12 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={form.rights_confirmed} onChange={(e) => set('rights_confirmed', e.target.checked)} style={{ marginTop: 2 }} />
                  <span>I have checked that this title may be shared digitally with students.</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={save} disabled={busy || !form.title.trim() || !form.author.trim() || form.levels.length === 0}>{busy ? 'Saving…' : 'Save'}</button>
                {editing && status !== 'published' && <button className="btn btn-secondary" onClick={() => changeStatus('published')} disabled={busy || !canPublish} title={canPublish ? undefined : 'Confirm the rights and add a file first'}>Publish</button>}
                {editing && status === 'published' && <button className="btn btn-secondary" onClick={() => changeStatus('draft')} disabled={busy}>Withdraw</button>}
                {editing && <button className="btn btn-danger" onClick={remove} disabled={busy}>Delete</button>}
              </div>
              {editing && <div style={{ marginTop: 6 }}><span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span></div>}

              {editing && (
                <div style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Files</div>
                  {files.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No files yet. Add a PDF to read, and audio to listen to.</p>}
                  {files.map((f) => (
                    <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <i className={`ti ${f.kind === 'pdf' ? 'ti-file-type-pdf' : 'ti-headphones'}`} aria-hidden="true" />
                      <input defaultValue={f.label} onBlur={(e) => renameFile(f, e.target.value)} aria-label="File label" style={{ flex: 1, padding: '4px 6px', fontSize: 12 }} />
                      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{f.kind === 'pdf' ? (f.pages ? `${f.pages} pp` : '') : f.duration_seconds ? formatDuration(f.duration_seconds) : ''}</span>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => removeFile(f.id)} aria-label="Delete this file"><i className="ti ti-trash" aria-hidden="true" /></button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}><i className="ti ti-upload" aria-hidden="true" /> Add PDF<input type="file" accept="application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files, 'pdf'); e.target.value = '' }} /></label>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}><i className="ti ti-upload" aria-hidden="true" /> Add audio<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav" multiple hidden onChange={(e) => { addFiles(e.target.files, 'audio'); e.target.value = '' }} /></label>
                  </div>
                  {uploading && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{uploading}</p>}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Several audio files become chapters, in file-name order. Each file can be up to 50 MB on the free plan.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
