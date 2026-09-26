import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { getPlayPool } from '@/lib/playDb'
import { PLAY_COOKIE, createPlayToken } from '@/lib/playSession'
import { signInFromExam, type ExamReader, type ExamClass } from '@/lib/playSso'

// Signs someone in to Smart Play from their exam login. The browser sends its exam access token; the
// server checks it, reads only what a game needs, and sets the Play session cookie. Whether Smart Play is
// switched on for the school is checked before this route runs (src/proxy.ts).
const examReader: ExamReader = {
  async userFromToken(accessToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
    if (error || !data.user) return null
    return { id: data.user.id, email: data.user.email ?? null }
  },
  async profile(userId) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name, student_id, grade_level, is_active')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return null
    return { id: data.id, role: data.role, fullName: data.full_name ?? '', studentId: data.student_id ?? null, gradeLevel: data.grade_level ?? null, isActive: data.is_active !== false }
  },
  async classesFor(userId, role): Promise<ExamClass[]> {
    const table = role === 'student' ? 'enrollments' : 'teacher_class_groups'
    const column = role === 'student' ? 'student_id' : 'teacher_id'
    const { data } = await supabaseAdmin.from(table).select('class_group_id, class_groups(id, name, year_grade)').eq(column, userId)
    const out: ExamClass[] = []
    for (const row of (data ?? []) as any[]) {
      const g = Array.isArray(row.class_groups) ? row.class_groups[0] : row.class_groups
      if (g?.id) out.push({ id: g.id, name: g.name, yearGrade: g.year_grade ?? null })
    }
    return out
  },
}

export async function POST(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined
  try {
    const result = await signInFromExam(examReader, getPlayPool(), token, process.env.NEXT_PUBLIC_SCHOOL_NAME || null)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const { token: playToken, maxAge } = createPlayToken(result.accountId)
    const response = NextResponse.json({ ok: true, role: result.role })
    response.cookies.set(PLAY_COOKIE, playToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge })
    return response
  } catch (err) {
    console.error('Play sign-in from exam login failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
