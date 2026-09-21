import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getLibraryAdmin } from '@/lib/libraryDb'
import { rateLimit } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { cleanLessons } from '@/lib/lessonPlan'

const schoolAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  accessToken: z.string().min(1).max(4000),
  subject: z.string().trim().min(1).max(200),
  grade: z.string().trim().min(1).max(50),
  term: z.string().trim().max(50).optional(),
  unitTheme: z.string().trim().max(300).optional(),
  focusStrand: z.string().trim().max(300).optional(),
  topic: z.string().trim().min(1).max(500),
  focusQuestion: z.string().trim().max(500).optional(),
  duration: z.string().trim().max(100).optional(),
  attainmentTarget: z.string().trim().max(2000).optional(),
  specificObjective: z.string().trim().max(2000).optional(),
  skills: z.string().trim().max(2000).optional(),
  priorLearning: z.string().trim().max(2000).optional(),
  materials: z.string().trim().max(2000).optional(),
  engage: z.string().trim().max(2000).optional(),
  explore: z.string().trim().max(2000).optional(),
  explain: z.string().trim().max(2000).optional(),
  elaborate: z.string().trim().max(2000).optional(),
  evaluate: z.string().trim().max(2000).optional(),
  successCriteria: z.string().trim().max(2000).optional(),
  // Unit fields (see 052/053). Optional so older clients keep publishing.
  subTopics: z.string().trim().max(3000).optional(),
  prerequisiteKnowledge: z.string().trim().max(3000).optional(),
  fourCs: z.string().trim().max(3000).optional(),
  subjectPractices: z.string().trim().max(3000).optional(),
  generalObjectives: z.string().trim().max(4000).optional(),
  keyTermsFormulae: z.string().trim().max(4000).optional(),
  lessons: z.array(z.record(z.string(), z.string().max(4000))).max(12).optional(),
}).strict()

// Publishes a copy of a plan (whatever the teacher currently has in the
// form, not a live-linked reference) into the shared central library. The
// school's own lesson_plans row is untouched -- this is a one-way copy, not
// a sync.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { accessToken, ...fields } = parsed.data

    const { data: userData, error: userError } = await schoolAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
    }
    const { data: callerProfile } = await schoolAdmin
      .from('profiles')
      .select('role, is_active, full_name')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile || !['teacher', 'supervisor', 'admin'].includes(callerProfile.role) || callerProfile.is_active === false) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const limited = await rateLimit(userData.user.id, 'lesson-plan-library-publish', { limit: 20, windowSeconds: 3600 })
    if (limited) return limited

    const library = getLibraryAdmin()
    if (!library) {
      return NextResponse.json({ error: 'The shared library isn’t connected for this school yet.', notConfigured: true }, { status: 503 })
    }

    const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME?.trim() || 'A partner school'

    const legacyRow = {
      school_name: schoolName,
      teacher_name: callerProfile.full_name || null,
      subject: fields.subject,
      grade: fields.grade,
      term: fields.term || null,
      unit_theme: fields.unitTheme || null,
      focus_strand: fields.focusStrand || null,
      topic: fields.topic,
      focus_question: fields.focusQuestion || null,
      duration: fields.duration || null,
      attainment_target: fields.attainmentTarget || null,
      specific_objective: fields.specificObjective || null,
      skills: fields.skills || null,
      prior_learning: fields.priorLearning || null,
      materials: fields.materials || null,
      engage: fields.engage || null,
      explore: fields.explore || null,
      explain: fields.explain || null,
      elaborate: fields.elaborate || null,
      evaluate: fields.evaluate || null,
      success_criteria: fields.successCriteria || null,
    }
    const lessons = cleanLessons(fields.lessons).filter((l) => Object.values(l).some(Boolean))
    const unitRow = {
      ...legacyRow,
      sub_topics: fields.subTopics || null,
      prerequisite_knowledge: fields.prerequisiteKnowledge || null,
      four_cs: fields.fourCs || null,
      subject_practices: fields.subjectPractices || null,
      general_objectives: fields.generalObjectives || null,
      key_terms_formulae: fields.keyTermsFormulae || null,
      lessons,
    }
    const hasUnitContent = lessons.length > 0 || [fields.subTopics, fields.prerequisiteKnowledge, fields.fourCs, fields.subjectPractices, fields.generalObjectives, fields.keyTermsFormulae].some(Boolean)

    // Try the full unit first. If the shared library's table hasn't been
    // given the unit columns yet (migration 053), fall back to the original
    // columns, which carry lesson 1, so publishing still works either way.
    let { error: insertError } = await library.from('shared_lesson_plans').insert(hasUnitContent ? unitRow : legacyRow)
    let partial = false
    if (insertError && hasUnitContent && /column|schema cache/i.test(insertError.message || '')) {
      partial = true
      ;({ error: insertError } = await library.from('shared_lesson_plans').insert(legacyRow))
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Could not publish this plan.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, partial })
  } catch (err) {
    console.error('lesson-plans/library/publish error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
