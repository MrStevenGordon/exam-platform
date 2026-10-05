'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import PdfReader from '@/components/library/PdfReader'
import { libraryGet, libraryErrorText, type LibraryBook, type LibraryFile } from '@/lib/library'

// useSearchParams() needs a Suspense boundary in this version of Next.js.
export default function ReadPage() {
  return (
    <Suspense fallback={<div className="page-container">Opening the book…</div>}>
      <ReadInner />
    </Suspense>
  )
}

function ReadInner() {
  const { id } = useParams<{ id: string }>()
  const search = useSearchParams()
  const fileId = search.get('file')
  const pageParam = parseInt(search.get('page') || '1', 10)
  const [book, setBook] = useState<LibraryBook | null>(null)
  const [file, setFile] = useState<LibraryFile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const detail = await libraryGet<{ book: LibraryBook; files: LibraryFile[] }>(`/api/library/books/${id}`)
        if (cancelled) return
        const pdfs = detail.files.filter((f) => f.kind === 'pdf')
        const chosen = pdfs.find((f) => f.id === fileId) ?? pdfs[0]
        if (!chosen) { setError('This book has no text to read.'); return }
        setBook(detail.book)
        setFile(chosen)
      } catch (err) {
        if (!cancelled) setError(libraryErrorText(err))
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, fileId])

  if (error) {
    return (
      <div className="page-container" style={{ maxWidth: 560 }}>
        <div className="banner banner-danger" style={{ marginBottom: 16 }}>{error}</div>
        <Link href={`/learning/library/${id}`} className="btn btn-secondary">Back to the book</Link>
      </div>
    )
  }
  if (!book || !file) return <div className="page-container">Opening the book…</div>
  return <PdfReader book={book} file={file} startPage={Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1} />
}
