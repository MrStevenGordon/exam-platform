'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BookCover from '@/components/library/BookCover'
import AudioPlayer from '@/components/library/AudioPlayer'
import { dueLabel, getMyRole, isAssignmentsAvailable, loadMyAssignments, type MyAssignment } from '@/lib/libraryAssignments'
import {
  libraryGet, libraryErrorText, loadBookProgress, loadLibrarySettings, formatDuration, LEVEL_LABEL, LICENCE_LABEL, SHELF_LABEL,
  type LibraryBook, type LibraryFile, type LibraryProgress,
} from '@/lib/library'

export default function BookPage() {
  const { id } = useParams<{ id: string }>()
  const [book, setBook] = useState<LibraryBook | null>(null)
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [progress, setProgress] = useState<LibraryProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const [given, setGiven] = useState<MyAssignment[]>([])
  const [canAssign, setCanAssign] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [detail, mine, role, on, controls] = await Promise.all([libraryGet<{ book: LibraryBook; files: LibraryFile[] }>(`/api/library/books/${id}`), loadBookProgress(id).catch(() => null), getMyRole(), isAssignmentsAvailable(), loadLibrarySettings()])
        const mineGiven = on && role?.role === 'student' ? (await loadMyAssignments().catch(() => [] as MyAssignment[])).filter((a) => a.book_id === id) : []
        if (cancelled) return
        setGiven(mineGiven)
        setCanAssign(on && controls.settings.teachers_assign && !!role && ['teacher', 'supervisor'].includes(role.role))
        setBook(detail.book)
        setFiles(detail.files)
        setProgress(mine)
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
  if (error || !book) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error || 'Book not found.'}</div>
        <Link href="/learning/library" className="btn btn-secondary">Back to the Library</Link>
      </div>
    )
  }

  const pdfs = files.filter((f) => f.kind === 'pdf')
  const audio = files.filter((f) => f.kind === 'audio')
  const readFile = pdfs.find((f) => f.id === progress?.read_file_id) ?? pdfs[0]
  const startPage = progress && progress.read_file_id === readFile?.id && progress.read_page > 0 ? progress.read_page : 1
  const audioStartId = progress?.listen_file_id ?? null
  const totalAudio = audio.reduce((sum, f) => sum + (f.duration_seconds ?? 0), 0)
  const levels = book.levels.map((l) => LEVEL_LABEL[l] || l)

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href="/learning/library" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}><i className="ti ti-arrow-left" aria-hidden="true" /> Library</Link>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 14 }}>
        <div>
          <BookCover title={book.title} author={book.author} bg={book.cover_bg} fg={book.cover_fg} width={220} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textAlign: 'center', marginTop: 10 }}>{LICENCE_LABEL[book.licence] || book.licence}</div>
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 className="portal-page-title" style={{ fontSize: 30, textTransform: 'none' }}>{book.title}</h1>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 12 }}>{book.author}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className="badge badge-default">{SHELF_LABEL[book.shelf]}</span>
            {book.subject && <span className="badge badge-default">{book.subject}</span>}
            {book.topic && <span className="badge badge-default">Topic: {book.topic}</span>}
            {levels.map((l) => <span key={l} className="badge badge-default">{l}</span>)}
          </div>

          {given.map((a) => {
            const due = dueLabel(a.due_date)
            return (
              <div key={a.assignment_id} className={`banner ${a.done ? 'banner-success' : 'banner-warning'}`} style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <i className={`ti ${a.done ? 'ti-circle-check' : 'ti-bookmark'}`} aria-hidden="true" style={{ marginTop: 2 }} />
                <div>
                  <b>{a.done ? 'Done:' : 'Assigned by'} {a.teacher_name}{a.done ? '' : ':'}</b> {a.part_label ? `${a.part_label}. ` : ''}{a.done ? '' : `${due.text}${due.late ? ' (late)' : ''}. `}
                  {!a.done && `You can ${a.allow_read && a.allow_listen ? 'read or listen' : a.allow_read ? 'read' : 'listen'}.`}
                  {a.note && <div style={{ marginTop: 4 }}>{a.note}</div>}
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {canAssign && <Link href={`/learning/library/${book.id}/assign`} className="btn btn-secondary"><i className="ti ti-users" aria-hidden="true" /> Assign to a class</Link>}
            {readFile && (
              <Link href={`/learning/library/${book.id}/read?file=${readFile.id}&page=${startPage}`} className="btn btn-primary">
                <i className="ti ti-book-2" aria-hidden="true" /> {startPage > 1 ? `Continue reading, page ${startPage}` : 'Read'}
              </Link>
            )}
            {audio.length > 0 && (
              <button className="btn btn-secondary" onClick={() => setListening((v) => !v)} aria-expanded={listening}>
                <i className="ti ti-headphones" aria-hidden="true" /> {listening ? 'Hide player' : `Listen${totalAudio > 0 ? `, ${formatDuration(totalAudio)}` : ''}`}
              </button>
            )}
          </div>
          {progress && progress.percent > 0 && (
            <>
              <div className="lib-prog" style={{ maxWidth: 420 }}><span style={{ width: `${progress.percent}%` }} /></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{progress.percent >= 100 ? 'Finished' : `${progress.percent}% done`}</div>
            </>
          )}

          {book.description && <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 560, margin: '18px 0' }}>{book.description}</p>}

          {listening && audio.length > 0 && (
            <div style={{ margin: '18px 0' }}>
              <AudioPlayer book={book} files={audio} startFileId={audioStartId} startSeconds={progress?.listen_seconds ?? 0} />
            </div>
          )}

          {pdfs.length > 1 && (
            <div className="card" style={{ padding: 0, maxWidth: 560, marginBottom: 16 }}>
              <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border)' }}>Parts to read</div>
              {pdfs.map((f, i) => (
                <Link key={f.id} href={`/learning/library/${book.id}/read?file=${f.id}&page=${progress?.read_file_id === f.id && progress.read_page > 0 ? progress.read_page : 1}`}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: 13, textDecoration: 'none', color: 'var(--text-primary)', borderBottom: i < pdfs.length - 1 ? '1px solid var(--border)' : 0 }}>
                  <span>{f.label || `Part ${i + 1}`}</span><span style={{ color: 'var(--text-muted)' }}>{f.pages ? `${f.pages} pages` : ''}</span>
                </Link>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 560, lineHeight: 1.6 }}>
            <strong>About this edition.</strong> {LICENCE_LABEL[book.licence] || book.licence}.
            {book.licence_note ? ` ${book.licence_note}` : ''}
            {book.attribution ? ` ${book.attribution}` : ''}
            {book.source_url && /^https?:\/\//i.test(book.source_url) && <> <a href={book.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-dark)' }}>Source</a></>}
          </div>
        </div>
      </div>
    </div>
  )
}
