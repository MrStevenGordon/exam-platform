import { NextRequest, NextResponse } from 'next/server'
import { authorizeLibraryUser, bookVisible, cleanSearch, filesAllowed, formatsOf, GENRE_BOOK_COLUMNS, PUBLIC_BOOK_COLUMNS } from '@/lib/libraryServer'

const LIMIT = 200

// The published books, optionally narrowed by shelf, subject or a search word. Each book says whether it can be
// read, listened to, or both, so the shelf can show the right badges without a request per book.
export async function GET(req: NextRequest) {
  try {
    const access = await authorizeLibraryUser(req)
    if (!access.ok) return access.response
    const { library, settings, hidden } = access

    const shelf = req.nextUrl.searchParams.get('shelf')
    const subject = req.nextUrl.searchParams.get('subject')?.trim().slice(0, 100)
    const q = cleanSearch(req.nextUrl.searchParams.get('q'))

    const run = (columns: string) => {
      let query = library.from('library_books').select(columns).eq('status', 'published').order('title').limit(LIMIT)
      if (shelf === 'curriculum' || shelf === 'fun') query = query.eq('shelf', shelf)
      if (subject) query = query.eq('subject', subject)
      if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,topic.ilike.%${q}%,subject.ilike.%${q}%`)
      return query
    }
    // Genres need central migration 002; until it is applied the list simply comes back without them.
    let result = await run(`${PUBLIC_BOOK_COLUMNS}, ${GENRE_BOOK_COLUMNS}`)
    if (result.error && /genre/i.test(result.error.message)) result = await run(PUBLIC_BOOK_COLUMNS)
    const { error } = result
    if (error) throw error
    const books = (result.data || []) as unknown as Array<Record<string, unknown>>
    const ids = (books || []).map((b) => b.id as string)

    const formats = new Map<string, Array<{ kind: string }>>()
    if (ids.length > 0) {
      const { data: files, error: filesError } = await library.from('library_files').select('book_id, kind').in('book_id', ids)
      if (filesError) throw filesError
      for (const f of (files || []) as Array<{ book_id: string; kind: string }>) formats.set(f.book_id, [...(formats.get(f.book_id) || []), f])
    }

    // Only titles a student can actually open are worth showing.
    const readable = (books || [])
      .filter((b) => bookVisible({ id: b.id as string, shelf: b.shelf as string, levels: b.levels as string[] }, settings, hidden))
      .map((b) => ({ ...b, formats: formatsOf(filesAllowed(formats.get(b.id as string) || [], settings)) }))
      .filter((b) => b.formats.length > 0)

    return NextResponse.json({ books: readable })
  } catch (err) {
    console.error('library/books GET error:', err)
    return NextResponse.json({ error: 'Could not load the Library. Please try again.' }, { status: 500 })
  }
}
