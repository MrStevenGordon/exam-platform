import { NextRequest, NextResponse } from 'next/server'
import { authorizeLibraryUser, formatsOf, PUBLIC_BOOK_COLUMNS, PUBLIC_FILE_COLUMNS, UUID_RE, LibraryFileRow } from '@/lib/libraryServer'

// One published book with the list of its files (chapters, parts), but never the files' storage paths.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })

    const access = await authorizeLibraryUser(req)
    if (!access.ok) return access.response
    const { library } = access

    const { data: book, error } = await library.from('library_books').select(PUBLIC_BOOK_COLUMNS).eq('id', id).eq('status', 'published').maybeSingle()
    if (error) throw error
    if (!book) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })

    const { data: files, error: filesError } = await library.from('library_files').select(PUBLIC_FILE_COLUMNS).eq('book_id', id).order('kind').order('position')
    if (filesError) throw filesError
    const list = (files || []) as LibraryFileRow[]

    return NextResponse.json({ book: { ...book, formats: formatsOf(list) }, files: list })
  } catch (err) {
    console.error('library/books/[id] GET error:', err)
    return NextResponse.json({ error: 'Could not open that book. Please try again.' }, { status: 500 })
  }
}
