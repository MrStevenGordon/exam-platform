import { NextRequest, NextResponse } from 'next/server'
import { authorizeLibraryUser, bookVisible, filesAllowed, LIBRARY_BUCKET, SIGNED_URL_SECONDS, UUID_RE } from '@/lib/libraryServer'
import { rateLimit } from '@/lib/rateLimit'

// Hands out a short-lived link to one file, only if the file belongs to a published book. The bucket is private,
// so this is the only way a browser can reach a file, and the link stops working after an hour.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

    const access = await authorizeLibraryUser(req)
    if (!access.ok) return access.response
    const { library, userId, settings, hidden } = access

    const limited = await rateLimit(userId, 'library-file-url', { limit: 300, windowSeconds: 3600 })
    if (limited) return limited

    const { data: file, error } = await library.from('library_files').select('id, book_id, kind, storage_path, pages, duration_seconds, library_books!inner(status, shelf, levels)').eq('id', id).maybeSingle()
    if (error) throw error
    const book = file?.library_books as unknown as { status?: string; shelf?: string; levels?: string[] } | null
    // Only published books, only ones this school shows, and no audio when the school has switched audio off.
    if (!file || book?.status !== 'published' || !bookVisible({ id: file.book_id as string, shelf: book.shelf || '', levels: book.levels || [] }, settings, hidden) || filesAllowed([{ kind: file.kind as string }], settings).length === 0) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    }

    const { data: signed, error: signError } = await library.storage.from(LIBRARY_BUCKET).createSignedUrl(file.storage_path, SIGNED_URL_SECONDS)
    if (signError || !signed?.signedUrl) throw signError || new Error('No link was returned')

    return NextResponse.json({ url: signed.signedUrl, kind: file.kind, pages: file.pages, durationSeconds: file.duration_seconds, expiresIn: SIGNED_URL_SECONDS })
  } catch (err) {
    console.error('library/files/[id]/url GET error:', err)
    return NextResponse.json({ error: 'Could not open that file. Please try again.' }, { status: 500 })
  }
}
