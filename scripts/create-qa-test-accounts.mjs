// Creates two fully isolated sets of school-section test accounts, one per
// tester, so two people can run demo/QA tests simultaneously without
// stepping on each other's data. Each set gets its own department + class
// group and: 1 Teacher, 1 Supervisor, 1 Team Lead, 1 Demo Team Lead, 5
// Students. No fake exam history is pre-seeded — accounts are wired up
// (subjects, enrollments, appointments) so testers can create/submit/
// review/publish exams live and exercise the real workflow end to end.
//
// Usage:
//   node scripts/create-qa-test-accounts.mjs
//
// Safe to re-run: looks up existing accounts/records before creating.

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
const PASSWORD = 'QaTest.Pass1'
const GRADE = 10
const TEAM_LEAD_SUBJECT = 'Mathematics'
const DEMO_TEAM_LEAD_SUBJECT = 'English'
const STUDENT_COUNT = 5

async function getOrCreateAuthUser(email) {
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email === email)
    if (found) return found.id
    if (data.users.length < 200) break
    page++
  }
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (createError) throw createError
  return created.user.id
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

async function createSet(setNumber) {
  const prefix = `qa${setNumber}`
  const deptName = `QA Test Department ${setNumber}`
  const className = `QA-10${setNumber}`

  const department = await getOrCreate('departments', { name: deptName }, { name: deptName })
  await ensureRow('department_subjects', { department_id: department.id, subject: TEAM_LEAD_SUBJECT }, {})
  await ensureRow('department_subjects', { department_id: department.id, subject: DEMO_TEAM_LEAD_SUBJECT }, {})

  const classGroup = await getOrCreate(
    'class_groups',
    { name: className, department_id: department.id },
    { name: className, department_id: department.id, year_grade: String(GRADE) }
  )

  const accounts = {}

  const teacherEmail = `${prefix}.teacher@${DOMAIN}`
  const teacherId = await getOrCreateAuthUser(teacherEmail)
  await upsertProfile(teacherId, {
    full_name: `QA${setNumber} Teacher`, first_name: `QA${setNumber}`, last_name: 'Teacher',
    role: 'teacher', department_id: department.id,
  })
  accounts.teacher = teacherEmail

  const supervisorEmail = `${prefix}.supervisor@${DOMAIN}`
  const supervisorId = await getOrCreateAuthUser(supervisorEmail)
  await upsertProfile(supervisorId, {
    full_name: `QA${setNumber} Supervisor`, first_name: `QA${setNumber}`, last_name: 'Supervisor',
    role: 'supervisor', department_id: department.id,
  })
  accounts.supervisor = supervisorEmail

  const { data: deptRow } = await supabase.from('departments').select('head_id').eq('id', department.id).single()
  if (!deptRow.head_id) {
    await supabase.from('departments').update({ head_id: supervisorId }).eq('id', department.id)
  }

  const teamLeadEmail = `${prefix}.teamlead@${DOMAIN}`
  const teamLeadId = await getOrCreateAuthUser(teamLeadEmail)
  await upsertProfile(teamLeadId, {
    full_name: `QA${setNumber} Team Lead`, first_name: `QA${setNumber}`, last_name: 'Team Lead',
    role: 'teacher', department_id: department.id,
  })
  await ensureRow('teacher_subjects', { teacher_id: teamLeadId, department_id: department.id, subject: TEAM_LEAD_SUBJECT }, {})
  await ensureRow(
    'team_lead_appointments',
    { teacher_id: teamLeadId, department_id: department.id, year_grade: GRADE, subject: TEAM_LEAD_SUBJECT },
    { appointed_by: supervisorId }
  )
  accounts.teamLead = teamLeadEmail

  const demoTeamLeadEmail = `${prefix}.demoteamlead@${DOMAIN}`
  const demoTeamLeadId = await getOrCreateAuthUser(demoTeamLeadEmail)
  await upsertProfile(demoTeamLeadId, {
    full_name: `QA${setNumber} Demo Team Lead`, first_name: `QA${setNumber}`, last_name: 'Demo Team Lead',
    role: 'teacher', department_id: department.id,
  })
  await ensureRow('teacher_subjects', { teacher_id: demoTeamLeadId, department_id: department.id, subject: DEMO_TEAM_LEAD_SUBJECT }, {})
  await ensureRow(
    'team_lead_appointments',
    { teacher_id: demoTeamLeadId, department_id: department.id, year_grade: GRADE, subject: DEMO_TEAM_LEAD_SUBJECT },
    { appointed_by: supervisorId }
  )
  accounts.demoTeamLead = demoTeamLeadEmail

  // Teacher teaches the team-lead subject and is assigned to the class group.
  await ensureRow('teacher_subjects', { teacher_id: teacherId, department_id: department.id, subject: TEAM_LEAD_SUBJECT }, {})
  await ensureRow('teacher_class_groups', { teacher_id: teacherId, class_group_id: classGroup.id }, {})

  accounts.students = []
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const studentEmail = `${prefix}.student${i}@${DOMAIN}`
    const studentId = await getOrCreateAuthUser(studentEmail)
    await upsertProfile(studentId, {
      full_name: `QA${setNumber} Student ${i}`, first_name: `QA${setNumber}`, last_name: `Student ${i}`,
      role: 'student', student_id: `QA${setNumber}STU00${i}`, grade_level: GRADE,
    })
    await ensureRow('enrollments', { student_id: studentId, class_group_id: classGroup.id }, {})
    accounts.students.push(studentEmail)
  }

  return accounts
}

async function run() {
  console.log('Creating QA test accounts (2 isolated sets)...\n')

  const set1 = await createSet(1)
  console.log('✓ Set 1 ready')
  const set2 = await createSet(2)
  console.log('✓ Set 2 ready')

  console.log('\n--- Done ---')
  console.log(`Password for every account: ${PASSWORD}\n`)
  for (const [label, accounts] of [['Tester 1', set1], ['Tester 2', set2]]) {
    console.log(`${label}:`)
    console.log(`  Teacher            ${accounts.teacher}`)
    console.log(`  Supervisor         ${accounts.supervisor}`)
    console.log(`  Team Lead          ${accounts.teamLead}  (log in as Teacher, then visit /teacher/team-lead)`)
    console.log(`  Demo Team Lead     ${accounts.demoTeamLead}  (log in as Teacher, then visit /teacher/team-lead)`)
    accounts.students.forEach((email, i) => console.log(`  Student ${i + 1}           ${email}`))
    console.log('')
  }
  console.log('No fake exam history was pre-seeded — log in and create/submit/review/publish exams live to test the real workflow.')
}

run().catch((err) => {
  console.error('\nFailed:', err.message || err)
  process.exit(1)
})
