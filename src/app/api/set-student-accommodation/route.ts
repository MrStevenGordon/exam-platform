import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { rateLimit } from '@/lib/rateLimit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const ACCOMMODATIONS = ['text_to_speech'] as const

const schema = z.object({
  studentId: z.string().uuid(),
  accommodation: z.enum(ACCOMMODATIONS),
  enabled: z.boolean(),
  accessToken: z.string().min(1).max(4000),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { studentId, accommodation, enabled, accessToken } = parsed.data

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile || !['teacher', 'supervisor', 'admin'].includes(callerProfile.role) || callerProfile.is_active === false) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const limited = await rateLimit(userData.user.id, 'set-student-accommodation', { limit: 30, windowSeconds: 60 })
    if (limited) return limited

    // Real authorization boundary, same pattern as /api/notify-student:
    // reuse the caller's own RLS-scoped session to confirm this is
    // actually a student they can see, rather than re-deriving ownership
    // rules server-side.
    const callerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )
    const { data: student } = await callerClient
      .from('profiles')
      .select('id, accommodations')
      .eq('id', studentId)
      .eq('role', 'student')
      .maybeSingle()

    if (!student) {
      return NextResponse.json({ error: 'Student not found or not accessible.' }, { status: 404 })
    }

    const current: string[] = Array.isArray(student.accommodations) ? student.accommodations : []
    const next = enabled
      ? Array.from(new Set([...current, accommodation]))
      : current.filter((a) => a !== accommodation)

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ accommodations: next })
      .eq('id', studentId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update accommodation.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, accommodations: next })
  } catch (err) {
    console.error('set-student-accommodation error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
