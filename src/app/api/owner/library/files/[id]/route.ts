import { NextRequest, NextResponse } from 'next/server'
import { authorizeOwner, filePatchSchema, isUuid, removeStoredFiles } from '@/lib/libraryOwner'
import { validateBody } from '@/lib/validateBody'

// Fills in what the browser learned about a file (its pages or length), or renames or reorders it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const parsed = await validateBody(req, filePatchSchema)
    if ('error' in parsed) return parsed.error
    const { data, error } = await access.library.from('library_files').update(parsed.data).eq('id', id).select('id, book_id, kind, label, position, bytes, pages, duration_seconds, created_at').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    return NextResponse.json({ file: data })
  } catch (err) {
    console.error('owner/library/files/[id] PATCH error:', err)
    return NextResponse.json({ error: 'Could not update that file.' }, { status: 500 })
  }
}

// Removes a file and its stored copy. If that was a published book's last file, the book goes back to draft.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const { library } = access
    const { data: file } = await library.from('library_files').select('id, book_id, storage_path').eq('id', id).maybeSingle()
    if (!file) return NextResponse.json({ ok: true })
    await removeStoredFiles(library, [file.storage_path as string])
    const { error } = await library.from('library_files').delete().eq('id', id)
    if (error) throw error
    const { count } = await library.from('library_files').select('id', { count: 'exact', head: true }).eq('book_id', file.book_id)
    if (!count) await library.from('library_books').update({ status: 'draft' }).eq('id', file.book_id).eq('status', 'published')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('owner/library/files/[id] DELETE error:', err)
    return NextResponse.json({ error: 'Could not delete that file.' }, { status: 500 })
  }
}
