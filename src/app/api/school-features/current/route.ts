import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { z } from 'zod'
import { verifySystemAdmin } from '@/lib/verifySystemAdmin'
import { validateBody } from '@/lib/validateBody'
import { ALL_EXAM_CATEGORIES, type ExamCategory } from '@/lib/schoolFeatures'

const schema = z.object({
  targetDatabaseUrl: z.string().trim().min(1).max(2000),
  accessToken: z.string().min(1).max(4000),
}).strict()

// Read-only counterpart to school-features/configure: opens the same kind of direct connection, reads
// that school's current enabled_features, and closes it — nothing is stored. Lets the owner console show
// what a school actually has switched on before saving over it (configure/route.ts replaces the whole set
// on every save, so saving without seeing the current state first can silently switch things off).
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { targetDatabaseUrl, accessToken } = parsed.data

    const admin = await verifySystemAdmin(accessToken)
    if (!admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const client = new Client({ connectionString: targetDatabaseUrl.trim(), ssl: { rejectUnauthorized: false } })
    try {
      await client.connect()

      const { rows } = await client.query('select enabled_features from school_settings limit 1')
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No school_settings row found in that database. Has it been provisioned yet?' }, { status: 400 })
      }

      const raw = (rows[0].enabled_features ?? {}) as Partial<{
        team_leads_enabled: boolean
        senior_team_leads_enabled: boolean
        exam_categories: string[]
        lesson_plan_library_enabled: boolean
        smart_learning_enabled: boolean
        smart_play_enabled: boolean
        ai_tutor_enabled: boolean
      }>

      // The same defaults getSchoolFeatures() uses client-side, so "nothing saved yet" reads the same way here
      // as it does in the app itself.
      const examCategories = Array.isArray(raw.exam_categories) ? raw.exam_categories.filter((c): c is ExamCategory => (ALL_EXAM_CATEGORIES as readonly string[]).includes(c)) : [...ALL_EXAM_CATEGORIES]

      return NextResponse.json({
        teamLeadsEnabled: raw.team_leads_enabled ?? true,
        seniorTeamLeadsEnabled: raw.senior_team_leads_enabled ?? true,
        examCategories,
        lessonPlanLibraryEnabled: raw.lesson_plan_library_enabled ?? true,
        smartLearningEnabled: raw.smart_learning_enabled ?? false,
        smartPlayEnabled: raw.smart_play_enabled ?? false,
        aiTutorEnabled: raw.ai_tutor_enabled ?? false,
        configured: rows[0].enabled_features != null,
      })
    } finally {
      await client.end()
    }
  } catch (err) {
    console.error('school-features/current error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, { status: 500 })
  }
}
