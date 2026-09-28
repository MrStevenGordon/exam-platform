import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const schema = z.object({
  decision: z.enum(['accepted', 'declined']),
  accessToken: z.string().min(1).max(4000),
}).strict()

// The school's own sign-off on the AI tutor, separate from the platform owner switching it on
// (school_settings.enabled_features.ai_tutor_enabled) — both are required before a student can
// use it (see tutorClient.ts and api/learning/tutor). Principal or VP only, matching every other
// leadership-only decision in this app.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { decision, accessToken } = parsed.data

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('role, is_active').eq('id', userData.user.id).single()
    if (!profile || profile.role !== 'principal' || profile.is_active === false) {
      return NextResponse.json({ error: 'Only the principal or vice principal can decide this.' }, { status: 403 })
    }

    const { data: settingsRow } = await supabaseAdmin.from('school_settings').select('id').limit(1).maybeSingle()
    if (!settingsRow) {
      return NextResponse.json({ error: 'No school settings found.' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('school_settings')
      .update({ ai_tutor_consent: decision, ai_tutor_consent_by: userData.user.id, ai_tutor_consent_at: new Date().toISOString() })
      .eq('id', settingsRow.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('learning/tutor-consent error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
