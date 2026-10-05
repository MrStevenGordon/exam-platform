'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { jamaicaDate } from '@/lib/attendance'
import BookCover from '@/components/library/BookCover'
import { libraryGet, libraryErrorText, LICENCE_LABEL, type LibraryBook, type LibraryFile } from '@/lib/library'
import { chapterTargets, getMyRole, loadMyClasses, pageTarget, type ClassOption } from '@/lib/libraryAssignments'

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 14 }
const fieldStyle: React.CSSProperties = { width: '100%', fontWeight: 400, textTransform: 'none' }

export default function AssignReadingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [book, setBook] = useState<LibraryBook | null>(null)
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [allowed, setAllowed] = useState(true)
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [part, setPart] = useState('')
  const [upTo, setUpTo] = useState('whole')
  const [page, setPage] = useState('')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [allowRead, setAllowRead] = useState(true)
  const [allowListen, setAllowListen] = useState(true)
  const [busy, setBusy] = useState(false)
  const today = jamaicaDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const me = await getMyRole()
        if (!me || !['teacher', 'supervisor'].includes(me.role)) { if (!cancelled) { setAllowed(false); setLoading(false) } return }
        const [detail, mine] = await Promise.all([libraryGet<{ book: LibraryBook; files: LibraryFile[] }>(`/api/library/books/${id}`), loadMyClasses(me.id)])
        if (cancelled) return
        setUserId(me.id)
        setBook(detail.book)
        setFiles(detail.files)
        setClasses(mine)
        setAllowRead(detail.book.formats.includes('read'))
        setAllowListen(detail.book.formats.includes('listen'))
      } catch (err) {
        if (!cancelled) setError(libraryErrorText(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="page-container">Loading…</div>
  if (!allowed) {
    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <div className="banner banner-warning" style={{ marginBottom: 16 }}>Reading is assigned by the teachers of a class.</div>
        <Link href={`/learning/library/${id}`} className="btn btn-secondary">Back to the book</Link>
      </div>
    )
  }
  if (!book) {
    return (
      <div className="page-container" style={{ maxWidth: 520 }}>
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error || 'Book not found.'}</div>
        <Link href="/learning/library" className="btn btn-secondary">Back to the Library</Link>
      </div>
    )
  }

  // The cast list is not a stopping point, so it is left out of the choices (it still counts towards the percentages).
  const chapters = chapterTargets(files).filter((c) => !/^(cast of characters|dramatis personae)$/i.test(c.label))
  const pdf = files.find((f) => f.kind === 'pdf')
  const pdfPages = pdf?.pages ?? 0

  function targetPercent(): number | string {
    if (upTo === 'whole') return 100
    if (upTo === 'page') {
      const n = parseInt(page, 10)
      if (!Number.isFinite(n) || n < 1 || n > pdfPages) return `Enter a page between 1 and ${pdfPages}.`
      return pageTarget(n, pdfPages)
    }
    const chapter = chapters[parseInt(upTo.slice(2), 10)]
    return chapter ? chapter.percent : 100
  }

  async function assign() {
    setError('')
    if (picked.size === 0) { setError('Choose at least one class.'); return }
    if (!allowRead && !allowListen) { setError('Let students read, listen, or both.'); return }
    if (due && due < today) { setError('The due date has already passed.'); return }
    const target = targetPercent()
    if (typeof target === 'string') { setError(target); return }
    setBusy(true)
    const label = part.trim() || (upTo.startsWith('c:') ? `Up to the end of ${chapters[parseInt(upTo.slice(2), 10)]?.label}` : upTo === 'page' ? `Up to page ${page}` : '')
    const { error: insertError } = await supabase.from('library_assignments').insert([...picked].map((class_group_id) => ({
      book_id: book!.id, book_title: book!.title, book_author: book!.author, cover_bg: book!.cover_bg, cover_fg: book!.cover_fg,
      class_group_id, assigned_by: userId, part_label: label || null, target_percent: target, allow_read: allowRead, allow_listen: allowListen,
      due_date: due || null, note: note.trim() || null,
    })))
    setBusy(false)
    if (insertError) { setError(insertError.code === '42501' ? 'You can only assign reading to classes you teach.' : insertError.message || 'Could not assign this.'); return }
    router.push('/learning/library/assignments')
  }

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href={`/learning/library/${book.id}`} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}><i className="ti ti-arrow-left" aria-hidden="true" /> {book.title}</Link>
      <h1 className="portal-page-title" style={{ marginTop: 10 }}>Assign reading</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>Choose the classes, how far they should get and by when. Students find it in their Library.</p>
      {error && <div className="banner banner-danger" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 420px', padding: 22 }}>
          <div style={{ ...labelStyle, gap: 8 }}>Classes
            {classes.length === 0 ? <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)' }}>You do not teach any classes yet.</span> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textTransform: 'none', fontWeight: 400, fontSize: 14 }}>
                {classes.map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                    <input type="checkbox" checked={picked.has(c.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} />
                    <span style={{ flex: 1 }}>{c.name}</span><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.students} student{c.students === 1 ? '' : 's'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <label style={labelStyle}>Which part (shown to students)<input value={part} onChange={(e) => setPart(e.target.value)} style={fieldStyle} maxLength={120} placeholder="Act 2" /></label>
          <label style={labelStyle}>Counts as done when they reach
            <select value={upTo} onChange={(e) => setUpTo(e.target.value)} style={fieldStyle}>
              <option value="whole">The end of the book</option>
              {chapters.map((c, i) => <option key={i} value={`c:${i}`}>The end of {c.label} (about {c.percent}% of the book)</option>)}
              {pdfPages > 0 && <option value="page">A page number</option>}
            </select>
          </label>
          {upTo === 'page' && <label style={labelStyle}>Page (1 to {pdfPages})<input value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" style={{ ...fieldStyle, maxWidth: 140 }} /></label>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>Due<input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} style={fieldStyle} /></label>
            <div style={{ ...labelStyle, gap: 8 }}>Students can
              <div style={{ display: 'flex', gap: 14, textTransform: 'none', fontWeight: 400, fontSize: 14 }}>
                {book.formats.includes('read') && <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={allowRead} onChange={(e) => setAllowRead(e.target.checked)} /> Read</label>}
                {book.formats.includes('listen') && <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={allowListen} onChange={(e) => setAllowListen(e.target.checked)} /> Listen</label>}
              </div>
            </div>
          </div>
          <label style={labelStyle}>Note to students<textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...fieldStyle, minHeight: 70 }} maxLength={500} placeholder="What to look out for" /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={assign} disabled={busy || classes.length === 0}>{busy ? 'Assigning…' : 'Assign to class'}</button>
            <Link href={`/learning/library/${book.id}`} className="btn btn-ghost">Cancel</Link>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>Progress is measured across the whole book (by page for reading, by time for listening), so &ldquo;done&rdquo; is a good guide rather than an exact line.</p>
        </div>
        <div className="card" style={{ flex: '0 0 240px', padding: 18, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><BookCover title={book.title} author={book.author} bg={book.cover_bg} fg={book.cover_fg} width={150} /></div>
          <div style={{ fontWeight: 700, marginTop: 12 }}>{book.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{book.author}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', marginTop: 8 }}>{LICENCE_LABEL[book.licence] || book.licence}</div>
        </div>
      </div>
    </div>
  )
}
