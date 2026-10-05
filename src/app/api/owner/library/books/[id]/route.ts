import { NextRequest, NextResponse } from 'next/server'
import { authorizeOwner, bookSchema, isUuid, removeStoredFiles } from '@/lib/libraryOwner'
import { validateBody } from '@/lib/validateBody'

// One book with its files.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const { data: book, error } = await access.library.from('library_books').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!book) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    const { data: files, error: filesError } = await access.library.from('library_files').select('id, book_id, kind, label, position, bytes, pages, duration_seconds, created_at').eq('book_id', id).order('kind').order('position')
    if (filesError) throw filesError
    return NextResponse.json({ book, files: files || [] })
  } catch (err) {
    console.error('owner/library/books/[id] GET error:', err)
    return NextResponse.json({ error: 'Could not open that book.' }, { status: 500 })
  }
}

// Updates a book's details. If rights are un-confirmed on a published book it goes back to draft, because a
// published book must always have its rights confirmed.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const parsed = await validateBody(req, bookSchema)
    if ('error' in parsed) return parsed.error

    const patch: Record<string, unknown> = { ...parsed.data }
    if (!parsed.data.rights_confirmed) patch.status = 'draft'
    const { data, error } = await access.library.from('library_books').update(patch).eq('id', id).select('*').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    return NextResponse.json({ book: data })
  } catch (err) {
    console.error('owner/library/books/[id] PUT error:', err)
    return NextResponse.json({ error: 'Could not save the book.' }, { status: 500 })
  }
}

// Deletes a book, its files and the stored copies.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const { data: files } = await access.library.from('library_files').select('storage_path').eq('book_id', id)
    await removeStoredFiles(access.library, (files || []).map((f) => f.storage_path as string))
    const { error } = await access.library.from('library_books').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('owner/library/books/[id] DELETE error:', err)
    return NextResponse.json({ error: 'Could not delete the book.' }, { status: 500 })
  }
}
