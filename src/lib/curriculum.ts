import { getLibraryAdmin } from '@/lib/libraryDb'
import { gradeFromText } from '@/lib/topics'
import { formatExcerpts, searchQuery, type CurriculumRow } from '@/lib/curriculumPure'

// The national curriculum text the lesson planner draws on, loaded into the central project (central migration 003).
// Best effort: if the central project is not connected, has no curriculum yet, or is slow, the planner simply drafts without it.

export type CurriculumResult = { text: string; sources: { title: string; pages: string }[] }
const NONE: CurriculumResult = { text: '', sources: [] }

export async function curriculumExcerpts(i: { subject: string; grade: string | number | null; topic: string; focusQuestion?: string; attainmentTarget?: string }): Promise<CurriculumResult> {
  try {
    const central = getLibraryAdmin()
    const grade = typeof i.grade === 'number' ? i.grade : gradeFromText(i.grade)
    const query = searchQuery(i)
    if (!central || grade === null || !query) return NONE
    const search = central.rpc('curriculum_search', { p_subject: i.subject, p_grade: grade, p_query: query, p_limit: 6 })
    const reply = await Promise.race([search, new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))])
    if (!reply || reply.error || !Array.isArray(reply.data)) return NONE
    return formatExcerpts(reply.data as CurriculumRow[])
  } catch (err) {
    console.error('curriculum excerpts failed:', err)
    return NONE
  }
}
