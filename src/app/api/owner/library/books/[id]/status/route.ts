import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeOwner, BOOK_STATUSES, isUuid } from '@/lib/libraryOwner'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({ status: z.enum(BOOK_STATUSES) }).strict()

// Publishes or withdraws a book. Publishing needs confirmed rights and at least one uploaded file; students
// only ever see published books.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { library } = access

    const { data: book } = await library.from('library_books').select('id, rights_confirmed').eq('id', id).maybeSingle()
    if (!book) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })

    if (parsed.data.status === 'published') {
      if (!book.rights_confirmed) return NextResponse.json({ error: 'Confirm that this title may be shared digitally with students before publishing.' }, { status: 400 })
      const { count } = await library.from('library_files').select('id', { count: 'exact', head: true }).eq('book_id', id)
      if (!count) return NextResponse.json({ error: 'Add at least one file before publishing.' }, { status: 400 })
    }
    const { data, error } = await library.from('library_books').update({ status: parsed.data.status }).eq('id', id).select('*').single()
    if (error) throw error
    return NextResponse.json({ book: data })
  } catch (err) {
    console.error('owner/library/books/[id]/status POST error:', err)
    return NextResponse.json({ error: 'Could not change the status.' }, { status: 500 })
  }
}
