import { NextRequest, NextResponse } from 'next/server'
import { authorizeOwner, bookSchema } from '@/lib/libraryOwner'
import { validateBody } from '@/lib/validateBody'

// All books in the central catalog (every status), with how many files each has.
export async function GET(req: NextRequest) {
  try {
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const { library } = access

    const { data: books, error } = await library.from('library_books').select('*').order('updated_at', { ascending: false }).limit(500)
    if (error) throw error
    const { data: files, error: filesError } = await library.from('library_files').select('book_id, kind')
    if (filesError) throw filesError
    const counts = new Map<string, { pdf: number; audio: number }>()
    for (const f of (files || []) as Array<{ book_id: string; kind: 'pdf' | 'audio' }>) {
      const c = counts.get(f.book_id) || { pdf: 0, audio: 0 }
      c[f.kind] += 1
      counts.set(f.book_id, c)
    }
    return NextResponse.json({ books: (books || []).map((b) => ({ ...b, files: counts.get(b.id as string) || { pdf: 0, audio: 0 } })) })
  } catch (err) {
    console.error('owner/library/books GET error:', err)
    return NextResponse.json({ error: 'Could not load the catalog.' }, { status: 500 })
  }
}

// Adds a book as a draft. Publishing is a separate step, after it has at least one file and its rights are confirmed.
export async function POST(req: NextRequest) {
  try {
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const parsed = await validateBody(req, bookSchema)
    if ('error' in parsed) return parsed.error

    const { data, error } = await access.library.from('library_books').insert({ ...parsed.data, status: 'draft' }).select('*').single()
    if (error) throw error
    return NextResponse.json({ book: data })
  } catch (err) {
    console.error('owner/library/books POST error:', err)
    return NextResponse.json({ error: 'Could not save the book.' }, { status: 500 })
  }
}
