import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { z } from 'zod'
import { verifySystemAdmin } from '@/lib/verifySystemAdmin'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  targetDatabaseUrl: z.string().trim().min(1).max(2000),
  features: z.object({
    teamLeadsEnabled: z.boolean().optional(),
    seniorTeamLeadsEnabled: z.boolean().optional(),
    examCategories: z.array(z.string().max(100)).max(50).optional(),
    lessonPlanLibraryEnabled: z.boolean().optional(),
  }).strict().optional(),
  accessToken: z.string().min(1).max(4000),
}).strict()

// Each school runs on its own separate Supabase project, so this owner-only
// route briefly opens a direct Postgres connection to that specific
// school's database (using the connection string supplied in the request)
// to write its feature config, then closes it. The connection string is
// never stored anywhere — storing every school's DB credentials centrally
// would undermine the whole point of keeping them in separate databases.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { targetDatabaseUrl, features, accessToken } = parsed.data

    const admin = await verifySystemAdmin(accessToken)
    if (!admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const config = {
      team_leads_enabled: !!features?.teamLeadsEnabled,
      senior_team_leads_enabled: !!features?.seniorTeamLeadsEnabled,
      exam_categories: Array.isArray(features?.examCategories) ? features.examCategories : [],
      lesson_plan_library_enabled: !!features?.lessonPlanLibraryEnabled,
    }

    const client = new Client({ connectionString: targetDatabaseUrl.trim(), ssl: { rejectUnauthorized: false } })
    try {
      await client.connect()

      const { rows } = await client.query('select id from school_settings limit 1')
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No school_settings row found in that database. Has it been provisioned yet?' }, { status: 400 })
      }

      await client.query('update school_settings set enabled_features = $1::jsonb where id = $2', [JSON.stringify(config), rows[0].id])
    } finally {
      await client.end()
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('school-features/configure error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, { status: 500 })
  }
}
