import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLibraryAdmin } from '@/lib/libraryDb'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

const PAGE_LIMIT = 30

const schoolAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Browses plans other schools have published. Auth is checked against THIS
// school's own Supabase project (the caller is a teacher logged into their
// own portal); the actual data read happens against the separate central
// library project via getLibraryAdmin().
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'lesson-plan-library-browse', { limit: 60, windowSeconds: 3600 })
    if (limited) return limited

    const accessToken = req.nextUrl.searchParams.get('accessToken')
    if (!accessToken) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

    const { data: userData, error: userError } = await schoolAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
    }
    const { data: callerProfile } = await schoolAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .single()
    if (!callerProfile || !['teacher', 'supervisor', 'admin'].includes(callerProfile.role) || callerProfile.is_active === false) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const library = getLibraryAdmin()
    if (!library) {
      return NextResponse.json({ error: 'The shared library isn’t connected for this school yet.', notConfigured: true }, { status: 503 })
    }

    const subject = req.nextUrl.searchParams.get('subject')?.trim()
    const grade = req.nextUrl.searchParams.get('grade')?.trim()
    const search = req.nextUrl.searchParams.get('search')?.trim()

    let query = library
      .from('shared_lesson_plans')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(PAGE_LIMIT)

    if (subject) query = query.ilike('subject', `%${subject}%`)
    if (grade) query = query.ilike('grade', `%${grade}%`)
    if (search) query = query.ilike('topic', `%${search}%`)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message || 'Could not load the library.' }, { status: 400 })
    }

    return NextResponse.json({ plans: data || [] })
  } catch (err) {
    console.error('lesson-plans/library GET error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
