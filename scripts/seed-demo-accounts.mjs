// Seeds one demo account per role — student, teacher, team lead, senior team
// lead, supervisor, school admin — plus enough exams/results/submissions so
// every dashboard shows real-looking data instead of empty states.
//
// Usage:
//   node scripts/seed-demo-accounts.mjs
//
// Safe to re-run: it looks up existing demo accounts/records by email or name
// before creating anything, so running it twice won't create duplicates.

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DOMAIN = 'mhs.smartassess'
const DEMO_PASSWORD = 'Demo.Pass1'
const DEPARTMENT_NAME = 'Demo Department'
const CLASS_NAME = 'Demo-10A'
const SUBJECT = 'Mathematics'
const GRADE = 10

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

// ---------- helpers ----------

async function getOrCreateAuthUser(email) {
  // Supabase JS doesn't have getUserByEmail, so page through listUsers.
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email === email)
    if (found) return { id: found.id, created: false }
    if (data.users.length < 200) break
    page++
  }
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw createError
  return { id: created.user.id, created: true }
}

async function upsertProfile(id, profile) {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', id).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('profiles').update(profile).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('profiles').insert({ id, ...profile })
    if (error) throw error
  }
}

async function getOrCreate(table, matchCols, insertCols) {
  const { data: existing, error: findError } = await supabase.from(table).select('*').match(matchCols).maybeSingle()
  if (findError) throw findError
  if (existing) return existing
  const { data: created, error: insertError } = await supabase.from(table).insert(insertCols).select().single()
  if (insertError) throw insertError
  return created
}

async function ensureRow(table, matchCols, insertCols) {
  const { data: existing, error: findError } = await supabase.from(table).select('id').match(matchCols).maybeSingle()
  if (findError) throw findError
  if (existing) return existing
  const { data: created, error: insertError } = await supabase.from(table).insert({ ...matchCols, ...insertCols }).select().single()
  if (insertError) throw insertError
  return created
}

// ---------- main ----------

async function run() {
  console.log('Seeding demo accounts and data...\n')

  // 1. Department + subject
  const department = await getOrCreate('departments', { name: DEPARTMENT_NAME }, { name: DEPARTMENT_NAME })
  await ensureRow('department_subjects', { department_id: department.id, subject: SUBJECT }, {})
  console.log(`✓ Department: ${DEPARTMENT_NAME}`)

  // 2. Class group
  const classGroup = await getOrCreate(
    'class_groups',
    { name: CLASS_NAME, department_id: department.id },
    { name: CLASS_NAME, department_id: department.id, year_grade: String(GRADE) }
  )
  console.log(`✓ Class group: ${CLASS_NAME}`)

  // 3. Accounts
  const accounts = {}

  const studentEmail = `demo.student@${DOMAIN}`
  const student = await getOrCreateAuthUser(studentEmail)
  await upsertProfile(student.id, {
    full_name: 'Demo Student', first_name: 'Demo', last_name: 'Student',
    role: 'student', student_id: 'DEMO001', grade_level: GRADE,
  })
  accounts.student = { email: studentEmail, id: student.id }

  const teacherEmail = `demo.teacher@${DOMAIN}`
  const teacher = await getOrCreateAuthUser(teacherEmail)
  await upsertProfile(teacher.id, {
    full_name: 'Demo Teacher', first_name: 'Demo', last_name: 'Teacher',
    role: 'teacher', department_id: department.id,
  })
  accounts.teacher = { email: teacherEmail, id: teacher.id }

  const teamLeadEmail = `demo.teamlead@${DOMAIN}`
  const teamLead = await getOrCreateAuthUser(teamLeadEmail)
  await upsertProfile(teamLead.id, {
    full_name: 'Demo Team Lead', first_name: 'Demo', last_name: 'Team Lead',
    role: 'teacher', department_id: department.id,
  })
  accounts.teamLead = { email: teamLeadEmail, id: teamLead.id }

  const seniorLeadEmail = `demo.seniorlead@${DOMAIN}`
  const seniorLead = await getOrCreateAuthUser(seniorLeadEmail)
  await upsertProfile(seniorLead.id, {
    full_name: 'Demo Senior Team Lead', first_name: 'Demo', last_name: 'Senior Team Lead',
    role: 'teacher', department_id: department.id,
  })
  accounts.seniorLead = { email: seniorLeadEmail, id: seniorLead.id }

  const supervisorEmail = `demo.supervisor@${DOMAIN}`
  const supervisor = await getOrCreateAuthUser(supervisorEmail)
  await upsertProfile(supervisor.id, {
    full_name: 'Demo Supervisor', first_name: 'Demo', last_name: 'Supervisor',
    role: 'supervisor', department_id: department.id,
  })
  accounts.supervisor = { email: supervisorEmail, id: supervisor.id }

  const adminEmail = `demo.admin@${DOMAIN}`
  const admin = await getOrCreateAuthUser(adminEmail)
  await upsertProfile(admin.id, {
    full_name: 'Demo Admin', first_name: 'Demo', last_name: 'Admin', role: 'admin',
  })
  accounts.admin = { email: adminEmail, id: admin.id }

  console.log('✓ 6 demo accounts ready')

  // Departments RLS keys off head_id, not profiles.department_id (see api/create-user).
  const { data: deptRow } = await supabase.from('departments').select('head_id').eq('id', department.id).single()
  if (!deptRow.head_id) {
    await supabase.from('departments').update({ head_id: supervisor.id }).eq('id', department.id)
  }

  // 4. Role wiring
  await ensureRow('teacher_subjects', { teacher_id: teacher.id, department_id: department.id, subject: SUBJECT }, {})
  await ensureRow('teacher_subjects', { teacher_id: teamLead.id, department_id: department.id, subject: SUBJECT }, {})
  await ensureRow('teacher_subjects', { teacher_id: seniorLead.id, department_id: department.id, subject: SUBJECT }, {})
  await ensureRow('teacher_class_groups', { teacher_id: teacher.id, class_group_id: classGroup.id }, {})
  await ensureRow('enrollments', { student_id: student.id, class_group_id: classGroup.id }, {})
  await ensureRow(
    'team_lead_appointments',
    { teacher_id: teamLead.id, department_id: department.id, year_grade: GRADE, subject: SUBJECT },
    { appointed_by: supervisor.id }
  )
  await ensureRow(
    'senior_team_lead_appointments',
    { teacher_id: seniorLead.id, department_id: department.id, year_grade: GRADE, subject: SUBJECT },
    { appointed_by: supervisor.id }
  )
  console.log('✓ Roles wired up (subjects, class assignment, enrollment, appointments)')

  // 5. Final exams (published, visible to the demo class)
  const finalExam1 = await getOrCreate(
    'final_exams',
    { title: 'Term 1 Mathematics Exam', department_id: department.id },
    {
      title: 'Term 1 Mathematics Exam', subject: SUBJECT, created_by: teamLead.id,
      status: 'published', duration_minutes: 90, exam_category: 'midterm',
      department_id: department.id, class_group_id: classGroup.id,
      published_at: daysAgo(30),
    }
  )
  const finalExam2 = await getOrCreate(
    'final_exams',
    { title: 'End of Year Mathematics Exam', department_id: department.id },
    {
      title: 'End of Year Mathematics Exam', subject: SUBJECT, created_by: teamLead.id,
      status: 'published', duration_minutes: 120, exam_category: 'end_of_year',
      department_id: department.id, class_group_id: classGroup.id,
      published_at: daysAgo(10),
    }
  )
  const finalExam3 = await getOrCreate(
    'final_exams',
    { title: 'Mock Mathematics Exam', department_id: department.id },
    {
      title: 'Mock Mathematics Exam', subject: SUBJECT, created_by: teamLead.id,
      status: 'published', duration_minutes: 60, exam_category: 'monthly',
      department_id: department.id, class_group_id: classGroup.id,
      published_at: daysAgo(1),
    }
  )
  for (const fe of [finalExam1, finalExam2, finalExam3]) {
    await ensureRow('final_exam_class_groups', { final_exam_id: fe.id, class_group_id: classGroup.id }, {})
  }
  console.log('✓ 3 final exams (2 with released results, 1 upcoming/not yet taken)')

  // 6. Draft exams: pop quiz (published, taken), homework (published, upcoming),
  //    one submitted for review, one approved awaiting publish
  const popQuiz = await getOrCreate(
    'draft_exams',
    { title: 'Algebra Pop Quiz', created_by: teacher.id },
    {
      title: 'Algebra Pop Quiz', subject: SUBJECT, created_by: teacher.id,
      status: 'published', exam_kind: 'pop_quiz', direct_published: true,
      direct_published_at: daysAgo(14), department_id: department.id,
    }
  )
  const homework = await getOrCreate(
    'draft_exams',
    { title: 'Geometry Homework', created_by: teacher.id },
    {
      title: 'Geometry Homework', subject: SUBJECT, created_by: teacher.id,
      status: 'published', exam_kind: 'homework', direct_published: true,
      direct_published_at: daysAgo(1), department_id: department.id,
    }
  )
  for (const de of [popQuiz, homework]) {
    await ensureRow('draft_exam_class_groups', { draft_exam_id: de.id, class_group_id: classGroup.id }, {})
  }

  await getOrCreate(
    'draft_exams',
    { title: 'Term 2 Mathematics Exam Submission', created_by: teacher.id },
    {
      title: 'Term 2 Mathematics Exam Submission', subject: SUBJECT, created_by: teacher.id,
      status: 'submitted', exam_kind: 'final_exam_submission', target_grade: GRADE,
      term: 'easter', department_id: department.id, submitted_at: daysAgo(2),
    }
  )
  await getOrCreate(
    'draft_exams',
    { title: 'Monthly Mathematics Exam — March', created_by: teamLead.id },
    {
      title: 'Monthly Mathematics Exam — March', subject: SUBJECT, created_by: teamLead.id,
      status: 'approved', exam_kind: 'monthly', target_grade: GRADE, term: 'easter',
      department_id: department.id, reviewed_by: seniorLead.id, reviewed_at: daysAgo(1),
    }
  )
  console.log('✓ Draft exams: 2 published to students, 1 pending supervisor review, 1 approved awaiting publish')

  // 7. Exam sessions for the demo student — released results + a score trend
  await ensureRow(
    'exam_sessions',
    { student_id: student.id, final_exam_id: finalExam1.id },
    { status: 'completed', started_at: daysAgo(29), completed_at: daysAgo(29), total_score: 78, max_possible_score: 100, fully_graded: true, results_released: true }
  )
  await ensureRow(
    'exam_sessions',
    { student_id: student.id, final_exam_id: finalExam2.id },
    { status: 'completed', started_at: daysAgo(9), completed_at: daysAgo(9), total_score: 65, max_possible_score: 100, fully_graded: true, results_released: true }
  )
  await ensureRow(
    'exam_sessions',
    { student_id: student.id, draft_exam_id: popQuiz.id },
    { status: 'completed', started_at: daysAgo(13), completed_at: daysAgo(13), total_score: 18, max_possible_score: 20, fully_graded: true, results_released: true }
  )
  // finalExam3 and homework deliberately left with no session -> show as "upcoming"
  console.log('✓ 3 completed/released exam sessions for the demo student (2 upcoming left untaken)')

  console.log('\n--- Done ---')
  console.log('Log in at /login with any of these (password for all: ' + DEMO_PASSWORD + '):\n')
  console.log(`  Student           ${accounts.student.email}`)
  console.log(`  Teacher           ${accounts.teacher.email}`)
  console.log(`  Team Lead         ${accounts.teamLead.email}  (log in as Teacher, then visit /teacher/team-lead)`)
  console.log(`  Senior Team Lead  ${accounts.seniorLead.email}  (log in as Teacher)`)
  console.log(`  Supervisor        ${accounts.supervisor.email}`)
  console.log(`  School Admin      ${accounts.admin.email}`)
}

run().catch((err) => {
  console.error('\nSeed failed:', err.message || err)
  process.exit(1)
})
