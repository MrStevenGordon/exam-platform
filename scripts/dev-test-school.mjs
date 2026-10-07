// Sets up the TEST school (the "Local Test School" Supabase project) with everything a full QA walk needs, so features can be tested and broken with no
// risk to a live school: the test staff and student accounts (with authenticator codes for the staff), a Grade 9 class of 30 students, the school day,
// and the Manchester demo data (results, lessons, attendance, feedback, support plans).
//
// Run the migrations first:  node scripts/apply-migrations.mjs --env .env.local --from 061 --apply --project <ref>
//
// Usage (a dry run first: it only reads and says what it would do):
//   node scripts/dev-test-school.mjs
// Then:
//   node scripts/dev-test-school.mjs --apply --project <project ref>
// Safe to run again: accounts and rows are looked up before they are created, and the demo seed removes what an earlier run added.
//
// Refuses to run on a school that already has 20 or more real staff or any student outside the test set, and needs --project to match the ref in
// NEXT_PUBLIC_SUPABASE_URL. The accounts all use the one test password below (a throwaway for this test project only). The staff accounts' authenticator
// secrets are written to .qa-totp.json (git-ignored); `node scripts/qa-totp.mjs testing.teacher` prints the current code.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { totp } from './lib/totp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null }
const apply = args.includes('--apply')
const project = flag('--project')
dotenv.config({ path: path.join(ROOT, '.env.local') })

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const DB = process.env.DATABASE_URL
if (!URL_ || !SECRET || !PUBLISHABLE || !DB) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY or DATABASE_URL in .env.local'); process.exit(1) }
const ref = new URL(URL_).hostname.split('.')[0]
if (!DB.includes(ref)) { console.error('DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL point at different projects. Fix .env.local first.'); process.exit(1) }
console.log(`Project: ${ref}   Mode: ${apply ? 'APPLY' : 'dry run (nothing is changed)'}`)
if (apply && project !== ref) { console.error(`Refusing to apply: add  --project ${ref}  to confirm this is the TEST project.`); process.exit(1) }

const DOMAIN = 'mhs.smartassess'
const PASSWORD = 'QaSchool.Test1'      // throwaway, test project only
const admin = createClient(URL_, SECRET, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } })
await db.connect()
const q = async (text, params) => (await db.query(text, params)).rows

// ---- the test set ----
const STAFF = [
  { key: 'testing.teacher', name: 'Testing Teacher', role: 'teacher', dept: 'Mathematics', subject: 'Mathematics', teachesClass: true },
  { key: 'testing.hod', name: 'Testing HOD', role: 'supervisor', dept: 'Mathematics', subject: 'Mathematics', head: true },
  { key: 'testing.principal', name: 'Testing Principal', role: 'principal', dept: null, title: 'Principal' },
  { key: 'testing.admin', name: 'Testing Admin', role: 'admin', dept: null },
  { key: 'testing.english', name: 'Testing English Teacher', role: 'teacher', dept: 'English', subject: 'English Language', teachesClass: false },
  { key: 'testing.science', name: 'Testing Science Teacher', role: 'teacher', dept: 'Science', subject: 'Science', teachesClass: false },
]
const FIRST = ['Jordan', 'Kemar', 'Shanice', 'Andre', 'Tanya', 'Marlon', 'Alicia', 'Devon', 'Kayla', 'Rohan', 'Nia', 'Chevaughn', 'Brianna', 'Tyrese', 'Latoya', 'Omar', 'Jada', 'Nathan', 'Simone', 'Dwayne', 'Camille', 'Leon', 'Abigail', 'Rashad', 'Monique', 'Kyle', 'Shelly-Ann', 'Javier', 'Crystal', 'Dane']
const LAST = ['Campbell', 'Reid', 'Brown', 'Williams', 'Clarke', 'Gordon', 'Thompson', 'Henry', 'Morgan', 'Bailey', 'Grant', 'Walker', 'Francis', 'Blake', 'Scott']
const STUDENTS = [{ id: '54321', first: 'Testing', last: 'Student' }, ...FIRST.map((f, i) => ({ id: String(54322 + i), first: f, last: LAST[(i * 7) % LAST.length] }))]
const CLASS_NAME = '3-1'
// the second demo pack: a Grade 8 class (English) and a Grade 10 class (Science), 25 students each
const FIRST2 = ['Aaliyah', 'Brandon', 'Chantelle', 'Damion', 'Elisha', 'Fabian', 'Gabrielle', 'Hakeem', 'Imani', 'Jermaine', 'Kadeem', 'Lisa-Marie', 'Marcia', 'Nathaniel', 'Olivia', 'Peta-Gaye', 'Quincy', 'Renae', 'Stefan', 'Tamika', 'Usain', 'Venesha', 'Warren', 'Yvonne', 'Zion']
const LAST2 = ['Ainsworth', 'Barrett', 'Chin', 'Dixon', 'Edwards', 'Foster', 'Graham', 'Hamilton', 'Ingram', 'Johnson', 'Kerr', 'Lewis', 'McKenzie', 'Nelson', 'Palmer', 'Robinson', 'Samuels', 'Taylor']
const EXTRA = [{ cls: '2-1', grade: 'Grade 8', gradeNum: 8, first: 54353 }, { cls: '4-1', grade: 'Grade 10', gradeNum: 10, first: 54378 }]

async function findUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
}
async function ensureUser(email) {
  const u = await findUser(email)
  if (u) {
    await admin.auth.admin.updateUserById(u.id, { password: PASSWORD, email_confirm: true })     // so every test login has the one test password
    return { id: u.id, created: false }
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  return { id: data.user.id, created: true }
}

// ---- checks (read only) ----
for (const p of ['class_feedback_ready', 'support_ready', 'videos_ready', 'flashcards_ready', 'student_topics_ready']) {
  const { error } = await admin.rpc(p)
  if (error) { console.error(`The migrations are not all applied yet (${p} is missing). Run apply-migrations.mjs first.`); process.exit(1) }
}
const ALL_IDS = [...STUDENTS.map((s) => s.id), ...EXTRA.flatMap((x) => FIRST2.map((_, i) => String(x.first + i)))]
const realStudents = await q(`select count(*)::int as n from profiles where role = 'student' and student_id <> all($1)`, [ALL_IDS])
const realStaff = await q(`select count(*)::int as n from profiles where role in ('teacher','supervisor') and full_name <> all($1)`, [STAFF.map((s) => s.name)])
if (realStudents[0].n > 0 || realStaff[0].n >= 20) { console.error(`This looks like a real school (${realStudents[0].n} other students, ${realStaff[0].n} other staff). Refusing.`); process.exit(1) }
console.log(`Plan: ${STAFF.length} staff accounts, ${STUDENTS.length} students in class ${CLASS_NAME} (Grade 9) plus 50 in two more classes, the school day, and the demo data.`)
if (!apply) { console.log('\nDry run only. Re-run with --apply --project ' + ref); await db.end(); process.exit(0) }

// ---- departments, class ----
let [dept] = await q(`select id from departments where name = 'Mathematics' limit 1`)
if (!dept) [dept] = await q(`insert into departments (name) values ('Mathematics') returning id`)
let [eng] = await q(`select id from departments where name = 'English' limit 1`)
if (!eng) [eng] = await q(`insert into departments (name) values ('English') returning id`)
let [sci] = await q(`select id from departments where name = 'Science' limit 1`)
if (!sci) [sci] = await q(`insert into departments (name) values ('Science') returning id`)
const deptId = { Mathematics: dept.id, English: eng.id, Science: sci.id }
let [cls] = await q(`select id from class_groups where name = $1 and year_grade = 'Grade 9' and department_id = $2 limit 1`, [CLASS_NAME, dept.id])
if (!cls) [cls] = await q(`insert into class_groups (name, year_grade, department_id, academic_year) values ($1, 'Grade 9', $2, $3) returning id`, [CLASS_NAME, dept.id, '2026-2027'])
console.log(`Class ${CLASS_NAME} ready.`)

// ---- staff ----
const ids = {}
for (const s of STAFF) {
  const email = `${s.key}@${DOMAIN}`
  const u = await ensureUser(email)
  ids[s.key] = u.id
  const [first, ...rest] = s.name.split(' ')
  const dId = s.dept ? deptId[s.dept] : null
  await db.query(
    `insert into profiles (id, full_name, first_name, last_name, role, department_id, is_active, must_change_password, leadership_title)
     values ($1,$2,$3,$4,$5,$6,true,false,$7)
     on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, department_id = excluded.department_id, is_active = true, must_change_password = false, leadership_title = excluded.leadership_title, onboarding_tours_seen = '{}'::jsonb`,
    [u.id, s.name, first, rest.join(' '), s.role, dId, s.title ?? null])
  if (s.subject) {
    await db.query(`insert into teacher_subjects (teacher_id, department_id, subject) select $1,$2,$3 where not exists (select 1 from teacher_subjects where teacher_id = $1 and subject = $3)`, [u.id, dId, s.subject])
    await db.query(`insert into department_subjects (department_id, subject) select $1,$2 where not exists (select 1 from department_subjects where department_id = $1 and lower(btrim(subject)) = lower($2))`, [dId, s.subject])
  }
  if (s.head) await db.query(`update departments set head_id = $1 where id = $2`, [u.id, dId])
  if (s.teachesClass) await db.query(`insert into teacher_class_groups (teacher_id, class_group_id) select $1,$2 where not exists (select 1 from teacher_class_groups where teacher_id = $1 and class_group_id = $2)`, [u.id, cls.id])
  console.log(`  ${u.created ? 'created' : 'updated'}  ${email}`)
}

// the English teacher teaches the Grade 8 class (the second demo pack), not the Grade 9 maths class an earlier version linked them to
await db.query(`delete from teacher_class_groups where teacher_id = $1 and class_group_id = $2`, [ids['testing.english'], cls.id])

// ---- students ----
for (const st of STUDENTS) {
  const email = `${st.id}@${DOMAIN}`
  const u = await ensureUser(email)
  await db.query(
    `insert into profiles (id, full_name, first_name, last_name, role, student_id, grade_level, is_active, must_change_password)
     values ($1,$2,$3,$4,'student',$5,9,true,false)
     on conflict (id) do update set full_name = excluded.full_name, student_id = excluded.student_id, grade_level = 9, is_active = true, must_change_password = false, onboarding_tours_seen = '{}'::jsonb`,
    [u.id, `${st.first} ${st.last}`, st.first, st.last, st.id])
  await db.query(`insert into enrollments (student_id, class_group_id) select $1,$2 where not exists (select 1 from enrollments where student_id = $1 and class_group_id = $2)`, [u.id, cls.id])
}
for (const x of EXTRA) {
  let [c2] = await q(`select id from class_groups where name = $1 and year_grade = $2 limit 1`, [x.cls, x.grade])
  if (!c2) [c2] = await q(`insert into class_groups (name, year_grade, department_id, academic_year) values ($1, $2, $3, $4) returning id`, [x.cls, x.grade, dept.id, '2026-2027'])
  for (let i = 0; i < FIRST2.length; i++) {
    const id = String(x.first + i), email = `${id}@${DOMAIN}`
    const u = await ensureUser(email)
    const last = LAST2[(i * 5 + x.gradeNum) % LAST2.length]
    await db.query(
      `insert into profiles (id, full_name, first_name, last_name, role, student_id, grade_level, is_active, must_change_password)
       values ($1,$2,$3,$4,'student',$5,$6,true,false)
       on conflict (id) do update set full_name = excluded.full_name, student_id = excluded.student_id, grade_level = excluded.grade_level, is_active = true, must_change_password = false, onboarding_tours_seen = '{}'::jsonb`,
      [u.id, `${FIRST2[i]} ${last}`, FIRST2[i], last, id, x.gradeNum])
    await db.query(`insert into enrollments (student_id, class_group_id) select $1,$2 where not exists (select 1 from enrollments where student_id = $1 and class_group_id = $2)`, [u.id, c2.id])
  }
  console.log(`  ${FIRST2.length} ${x.grade} students ready in class ${x.cls}`)
}
console.log(`  ${STUDENTS.length} students ready (sign-in: <student id>@${DOMAIN}; the test student is 54321).`)

// ---- authenticator codes for the staff ----
const secretsFile = path.join(ROOT, '.qa-totp.json')
const secrets = fs.existsSync(secretsFile) ? JSON.parse(fs.readFileSync(secretsFile, 'utf8')) : {}
for (const s of STAFF) {
  const email = `${s.key}@${DOMAIN}`
  const userId = ids[s.key]
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId })
  const verified = (factors?.factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified')
  if (verified.length && secrets[email]) continue
  for (const f of factors?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id })
  const client = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } })
  const { error: signErr } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signErr) throw signErr
  const { data: enr, error: enrErr } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'qa' })
  if (enrErr) throw enrErr
  const { data: ch, error: chErr } = await client.auth.mfa.challenge({ factorId: enr.id })
  if (chErr) throw chErr
  const { error: vErr } = await client.auth.mfa.verify({ factorId: enr.id, challengeId: ch.id, code: totp(enr.totp.secret) })
  if (vErr) throw vErr
  secrets[email] = enr.totp.secret
  console.log(`  authenticator set up for ${email}`)
}
fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2) + '\n', { mode: 0o600 })

// ---- school day and demo data ----
const runFile = async (rel) => { await db.query(fs.readFileSync(path.join(ROOT, rel), 'utf8')); console.log(`  ran ${rel}`) }
await runFile('scripts/data/manchester-school-day.sql')
await runFile('scripts/demo/manchester-demo-seed.sql')
await db.end()
console.log(`\nDone. Test logins use the password set at the top of scripts/dev-test-school.mjs. Staff sign-in needs a code: node scripts/qa-totp.mjs testing.teacher`)
