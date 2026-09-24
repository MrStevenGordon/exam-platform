import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateBody } from '@/lib/validateBody'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { studentWelcomeEmail } from '@/lib/emailTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

const CLASS_TO_GRADE: Record<string, number> = {
  '1': 7, '2': 8, '3': 9, '4': 10, '5': 11
}

// The student's real school inbox (e.g. john.doe@stu.mhs.edu.jm) — separate
// from their id#@mhs.smartassess login, which was never a real address.
// Used to send them actual notifications. Auto-derived from their name when
// not supplied explicitly in the CSV; see deriveSchoolEmail below.
const SCHOOL_EMAIL_DOMAIN = 'stu.mhs.edu.jm'

function deriveSchoolEmail(firstName: string, lastName: string): string {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z]/g, '')
  return `${normalize(firstName)}.${normalize(lastName)}@${SCHOOL_EMAIL_DOMAIN}`
}

const schema = z.object({
  type: z.enum(['student', 'staff', 'reset-password']),
  accessToken: z.string().min(1).max(4000),
  data: z.object({
    // student
    first_name: z.string().trim().min(1).max(100).optional(),
    middle_name: z.string().trim().max(100).optional(),
    last_name: z.string().trim().min(1).max(100).optional(),
    student_id: z.string().trim().min(1).max(50).optional(),
    class_id: z.string().trim().min(1).max(50).optional(),
    birth_date: z.string().max(20).optional(),
    gender: z.string().max(30).optional(),
    birth_year: z.union([z.string(), z.number()]).optional(),
    school_email: z.union([z.string().trim().email().max(320), z.literal('')]).optional(),
    // staff
    email: z.string().trim().email().max(320).optional(),
    role: z.enum(['teacher', 'supervisor', 'admin', 'principal']).optional(),
    leadership_title: z.enum(['Principal', 'Vice Principal']).optional(),
    department_id: z.string().uuid().optional(),
    subjects: z.string().max(1000).optional(),
    // reset-password
    user_id: z.string().uuid().optional(),
    password: z.string().min(8).max(200).optional(),
  }).strict(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { type, data, accessToken } = parsed.data

    // This route uses the service-role key and bypasses RLS entirely —
    // creating accounts (with a well-known default password) and
    // resetting arbitrary passwords. It was previously reachable with no
    // auth check at all; re-derive the caller's identity from their own
    // token rather than trusting anything client-supplied, same boundary
    // verifySystemAdmin() enforces for owner-only routes.
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
    if (callerError || !callerData.user) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', callerData.user.id)
      .single()
    if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.is_active === false) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    if (type === 'reset-password') {
      // A school admin must never be able to reset the platform owner's
      // password — is_system_admin is a separate, higher-privilege flag
      // that role='admin' alone doesn't grant.
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('is_system_admin')
        .eq('id', data?.user_id)
        .single()
      if (targetProfile?.is_system_admin) {
        return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
      }
    }

    if (type === 'student') {
      const { first_name, middle_name, last_name, student_id, class_id, birth_date, gender, birth_year, school_email: providedSchoolEmail } = data
      const email = `${student_id}@mhs.smartassess`
      const fullName = [first_name, middle_name, last_name].filter(Boolean).join(' ')
      const gradePrefix = class_id?.split('-')[0]
      const gradeLevel = (gradePrefix ? CLASS_TO_GRADE[gradePrefix] : null) || null

      // Get class group
      const { data: classGroup } = await supabaseAdmin
        .from('class_groups')
        .select('id')
        .eq('name', class_id)
        .single()

      if (!classGroup) {
        return NextResponse.json({ error: `Class ${class_id} not found` }, { status: 400 })
      }

      // Resolve the student's real school inbox: use what the CSV supplied,
      // or derive it from their name. If a derived guess collides with an
      // existing student's address, leave it blank rather than silently
      // sending someone else's real notifications to the wrong person —
      // the caller can add it manually afterward.
      let schoolEmail: string | null = providedSchoolEmail?.trim() || null
      let schoolEmailWarning: string | null = null
      if (!schoolEmail && first_name && last_name) {
        const derived = deriveSchoolEmail(first_name, last_name)
        const { data: existingEmail } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('school_email', derived)
          .maybeSingle()
        if (existingEmail) {
          schoolEmailWarning = `Auto-generated school email "${derived}" is already used by another student — left blank, add it manually.`
        } else {
          schoolEmail = derived
        }
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: 'Student.Test',
        email_confirm: true,
      })

      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

      // Create profile
      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        first_name,
        middle_name: middle_name || null,
        last_name,
        student_id,
        role: 'student',
        birth_date: birth_date || null,
        gender: gender || null,
        birth_year: birth_year ? parseInt(String(birth_year), 10) : null,
        grade_level: gradeLevel,
        must_change_password: true,
        school_email: schoolEmail,
      })

      if (profileError) {
        console.error('Profile error:', profileError)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }

      // Enroll in class
      const { error: enrollError } = await supabaseAdmin.from('enrollments').insert({
        student_id: authData.user.id,
        class_group_id: classGroup.id,
      })

      if (enrollError) console.error('Enroll error:', enrollError)

      // Best-effort — a flaky send shouldn't fail an otherwise-successful
      // account creation.
      if (schoolEmail) {
        try {
          const { subject, html } = studentWelcomeEmail(fullName, email, 'Student.Test')
          await sendEmail({ to: schoolEmail, subject, html, from: EMAIL_FROM.notifications })
        } catch (emailError) {
          console.error('student welcome email failed:', emailError)
        }
      }

      return NextResponse.json({ success: true, email, schoolEmail, schoolEmailWarning })
    }

    if (type === 'staff') {
      const { first_name, last_name, email, role, department_id, subjects, leadership_title } = data
      const fullName = `${first_name} ${last_name}`

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: 'Staff.Default1',
        email_confirm: true,
      })

      if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        first_name,
        last_name,
        role: role || 'teacher',
        department_id: department_id || null,
        // Only sent for principals, so creating any other kind of account
        // never touches the leadership_title column.
        ...(role === 'principal' ? { leadership_title: leadership_title || 'Vice Principal' } : {}),
        must_change_password: true,
      })

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }

      // Every RLS policy that scopes a supervisor's access checks
      // departments.head_id, not profiles.department_id — without this,
      // a newly-imported supervisor looks correctly set up in the UI but
      // can't actually do anything (every check silently fails).
      if ((role === 'supervisor') && department_id) {
        const { data: dept } = await supabaseAdmin.from('departments').select('head_id').eq('id', department_id).single()
        if (dept && !dept.head_id) {
          await supabaseAdmin.from('departments').update({ head_id: authData.user.id }).eq('id', department_id)
        }
      }

      const subjectNames: string[] = (subjects || '')
        .split(';')
        .map((s: string) => s.trim())
        .filter(Boolean)

      if (subjectNames.length > 0) {
        const { data: subjectRows } = await supabaseAdmin
          .from('department_subjects')
          .select('department_id, subject')
          .in('subject', subjectNames)

        const rowsToInsert = subjectNames
          .map((name) => {
            const match = (subjectRows || []).find((r: any) => r.subject.toLowerCase() === name.toLowerCase())
            return match ? { teacher_id: authData.user.id, department_id: match.department_id, subject: match.subject } : null
          })
          .filter(Boolean)

        if (rowsToInsert.length > 0) {
          await supabaseAdmin.from('teacher_subjects').insert(rowsToInsert as any)
        }
      }

      return NextResponse.json({ success: true, email })
    }

    if (type === 'reset-password') {
      const { user_id, password } = data
      if (!user_id || !password) {
        return NextResponse.json({ error: 'user_id and password are required.' }, { status: 400 })
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      // The admin chose this password, so they know it too — require the
      // account holder to set their own on next login, same as a fresh
      // account creation.
      await supabaseAdmin.from('profiles').update({ must_change_password: true }).eq('id', user_id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  } catch (err: any) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
