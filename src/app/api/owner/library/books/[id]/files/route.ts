import { NextRequest, NextResponse } from 'next/server'
import { authorizeOwner, extensionFor, fileSchema, isUuid } from '@/lib/libraryOwner'
import { LIBRARY_BUCKET } from '@/lib/libraryServer'
import { validateBody } from '@/lib/validateBody'

// Creates a place for one file: records it against the book and returns a one-time upload link, so the browser can
// send a large file straight to storage instead of through this server. The file's pages or length are filled in
// afterwards (PATCH /api/owner/library/files/[id]) once the browser has read them.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const parsed = await validateBody(req, fileSchema)
    if ('error' in parsed) return parsed.error
    const { library } = access

    const ext = extensionFor(parsed.data.kind, parsed.data.contentType)
    if (!ext) return NextResponse.json({ error: parsed.data.kind === 'pdf' ? 'A text file must be a PDF.' : 'Audio must be MP3, M4A, OGG or WAV.' }, { status: 400 })

    const { data: book } = await library.from('library_books').select('id').eq('id', id).maybeSingle()
    if (!book) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })

    const fileId = crypto.randomUUID()
    const path = `${id}/${fileId}.${ext}`
    const { data: signed, error: signError } = await library.storage.from(LIBRARY_BUCKET).createSignedUploadUrl(path)
    if (signError || !signed) throw signError || new Error('No upload link was returned')

    const { data: file, error } = await library.from('library_files').insert({
      id: fileId, book_id: id, kind: parsed.data.kind, label: parsed.data.label, position: parsed.data.position, storage_path: path, bytes: parsed.data.bytes ?? null,
    }).select('id, book_id, kind, label, position, bytes, pages, duration_seconds, created_at').single()
    if (error) throw error

    return NextResponse.json({ file, upload: { signedUrl: signed.signedUrl, token: signed.token, path } })
  } catch (err) {
    console.error('owner/library/books/[id]/files POST error:', err)
    return NextResponse.json({ error: 'Could not prepare that upload.' }, { status: 500 })
  }
}
