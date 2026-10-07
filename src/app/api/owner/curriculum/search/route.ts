import { NextRequest, NextResponse } from 'next/server'
import { authorizeOwner } from '@/lib/libraryOwner'

// Try the same search the lesson planner uses, so the owner can see what a topic would pull from the guides.
export async function GET(req: NextRequest) {
  try {
    const access = await authorizeOwner(req)
    if (!access.ok) return access.response
    const subject = (req.nextUrl.searchParams.get('subject') || '').trim().slice(0, 100)
    const grade = Number(req.nextUrl.searchParams.get('grade'))
    const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 400)
    if (!subject || !q || !Number.isInteger(grade) || grade < 7 || grade > 13) return NextResponse.json({ error: 'Give a subject, a grade from 7 to 13 and some words to look for.' }, { status: 400 })
    const { data, error } = await access.library.rpc('curriculum_search', { p_subject: subject, p_grade: grade, p_query: q, p_limit: 6 })
    if (error) throw error
    return NextResponse.json({ results: data || [] })
  } catch (err) {
    console.error('owner/curriculum/search error:', err)
    return NextResponse.json({ error: 'The search failed.' }, { status: 500 })
  }
}
