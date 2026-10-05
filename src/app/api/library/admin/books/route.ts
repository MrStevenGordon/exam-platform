import { NextRequest, NextResponse } from 'next/server'
import { authorizeLibraryUser, formatsOf, PUBLIC_BOOK_COLUMNS } from '@/lib/libraryServer'

// For the school admin's Library settings: every published book, whether or not this school currently shows it, so a
// hidden title can be shown again. Other roles are refused.
export async function GET(req: NextRequest) {
  try {
    const access = await authorizeLibraryUser(req)
    if (!access.ok) return access.response
    if (access.role !== 'admin') return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    const { library, hidden } = access

    const { data: books, error } = await library.from('library_books').select(PUBLIC_BOOK_COLUMNS).eq('status', 'published').order('title').limit(500)
    if (error) throw error
    const ids = (books || []).map((b) => b.id as string)
    const kinds = new Map<string, Array<{ kind: string }>>()
    if (ids.length > 0) {
      const { data: files, error: filesError } = await library.from('library_files').select('book_id, kind').in('book_id', ids)
      if (filesError) throw filesError
      for (const f of (files || []) as Array<{ book_id: string; kind: string }>) kinds.set(f.book_id, [...(kinds.get(f.book_id) || []), f])
    }
    return NextResponse.json({ books: (books || []).map((b) => ({ ...b, formats: formatsOf(kinds.get(b.id as string) || []), hidden: hidden.has(b.id as string) })) })
  } catch (err) {
    console.error('library/admin/books GET error:', err)
    return NextResponse.json({ error: 'Could not load the titles.' }, { status: 500 })
  }
}
