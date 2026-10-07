import { NextRequest, NextResponse } from 'next/server'
import { authorizeOwner } from '@/lib/libraryOwner'

// The curriculum guides loaded into the central search (central migration 003), for the platform owner.
export async function GET(req: NextRequest) {
  try {
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const { data, error } = await access.library.from('curriculum_documents')
      .select('id, title, subject, aliases, grade_from, grade_to, publisher, published_year, pages, chunk_count, status, created_at').order('subject').order('grade_from')
    if (error) {
      // 42P01 = the table is not there: central migration 003 has not been applied.
      if (error.code === '42P01' || /curriculum_documents/.test(error.message)) return NextResponse.json({ error: 'The curriculum tables are not set up yet. Run central migration 003 on the central project.', notInstalled: true }, { status: 200 })
      throw error
    }
    return NextResponse.json({ documents: data || [] })
  } catch (err) {
    console.error('owner/curriculum GET error:', err)
    return NextResponse.json({ error: 'Could not load the curriculum guides.' }, { status: 500 })
  }
}
