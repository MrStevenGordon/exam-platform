// One-way roster provisioning: copies student ID#, name and grade from the
// exam database (READ ONLY) into game accounts in the Play database.
// Nothing is ever written to the exam database. Re-running is safe: existing
// accounts keep their password unless --reset-passwords is passed.
//
//   node scripts/play/provision_from_roster.mjs [--password smart.play] [--reset-passwords]
//        [--teachers nicholas.simpson@mhs.smartassess,rameish.brooks@mhs.smartassess]
// --teachers provisions game accounts for the listed teacher emails; their Play
// login id is the part of the email before the @.
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local', quiet: true })

const args = process.argv.slice(2)
const pwIdx = args.indexOf('--password')
const password = pwIdx >= 0 ? args[pwIdx + 1] : 'smart.play'
const resetPasswords = args.includes('--reset-passwords')
const tIdx = args.indexOf('--teachers')
const teacherEmails = tIdx >= 0 ? args[tIdx + 1].split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) : []
const school = process.env.NEXT_PUBLIC_SCHOOL_NAME || null

const playUrl = process.env.PLAY_DATABASE_URL || 'postgres://play@127.0.0.1:54329/play'
if (!/127\.0\.0\.1|localhost/.test(playUrl) && !args.includes('--allow-remote')) {
  console.error('Refusing to write to a non-local Play database without --allow-remote.')
  process.exit(1)
}

const exam = new pg.Client({ connectionString: process.env.DATABASE_URL })
const play = new pg.Client({ connectionString: playUrl })

await exam.connect()
await play.connect()
try {
  await exam.query('begin read only')
  const { rows: students } = await exam.query(
    `select student_id, full_name, grade_level
       from profiles
      where role = 'student' and student_id is not null and coalesce(is_active, true)
      order by student_id`
  )
  let teachers = []
  if (teacherEmails.length > 0) {
    const t = await exam.query(
      `select lower(u.email) as email, p.full_name
         from profiles p join auth.users u on u.id = p.id
        where p.role = 'teacher' and coalesce(p.is_active, true) and lower(u.email) = any($1)`,
      [teacherEmails]
    )
    teachers = t.rows
  }
  // Classes, who is in them, and which teachers teach them (read-only).
  const classes = (await exam.query('select id, name, year_grade from class_groups')).rows
  const enrollments = (await exam.query(
    `select e.class_group_id, p.student_id from enrollments e join profiles p on p.id = e.student_id where p.student_id is not null`
  )).rows
  const assignments = (await exam.query(
    `select t.class_group_id, lower(u.email) as email from teacher_class_groups t join auth.users u on u.id = t.teacher_id`
  )).rows
  await exam.query('rollback')

  let created = 0, updated = 0
  await play.query('begin')
  for (const s of students) {
    const res = await play.query(
      `insert into play_accounts (student_id, display_name, grade_level, school, password_hash)
       values ($1, $2, $3, $4, crypt($5, gen_salt('bf')))
       on conflict (student_id) do update
         set display_name = excluded.display_name,
             grade_level = excluded.grade_level,
             school = excluded.school,
             password_hash = case when $6 then excluded.password_hash else play_accounts.password_hash end
       returning (xmax = 0) as inserted`,
      [s.student_id, s.full_name, s.grade_level, school, password, resetPasswords]
    )
    if (res.rows[0].inserted) created++; else updated++
  }
  for (const t of teachers) {
    const res = await play.query(
      `insert into play_accounts (student_id, display_name, grade_level, school, password_hash, role)
       values ($1, $2, null, $3, crypt($4, gen_salt('bf')), 'teacher')
       on conflict (student_id) do update
         set display_name = excluded.display_name, school = excluded.school, role = 'teacher',
             password_hash = case when $5 then excluded.password_hash else play_accounts.password_hash end
       returning (xmax = 0) as inserted`,
      [t.email.split('@')[0], t.full_name, school, password, resetPasswords]
    )
    if (res.rows[0].inserted) created++; else updated++
  }
  // Classes are replaced wholesale so the copy always mirrors the exam database.
  await play.query('delete from play_class_members')
  await play.query('delete from play_class_teachers')
  const classIds = new Map()
  for (const c of classes) {
    const r = await play.query(
      `insert into play_classes (name, grade_label, source_class_id) values ($1, $2, $3)
       on conflict (source_class_id) do update set name = excluded.name, grade_label = excluded.grade_label
       returning id`,
      [c.name, c.year_grade, c.id]
    )
    classIds.set(c.id, r.rows[0].id)
  }
  await play.query('delete from play_classes where source_class_id <> all($1::uuid[])', [classes.map((c) => c.id)])
  let members = 0, classTeachers = 0
  for (const e of enrollments) {
    const cid = classIds.get(e.class_group_id)
    if (!cid) continue
    const r = await play.query(
      `insert into play_class_members (class_id, account_id)
       select $1, id from play_accounts where student_id = $2 and role = 'student' on conflict do nothing`,
      [cid, e.student_id]
    )
    members += r.rowCount
  }
  for (const a of assignments) {
    const cid = classIds.get(a.class_group_id)
    if (!cid) continue
    const r = await play.query(
      `insert into play_class_teachers (class_id, account_id)
       select $1, id from play_accounts where student_id = $2 and role = 'teacher' on conflict do nothing`,
      [cid, a.email.split('@')[0]]
    )
    classTeachers += r.rowCount
  }
  await play.query('commit')
  console.log(`Classes copied: ${classes.length}, memberships: ${members}, teacher assignments: ${classTeachers}.`)
  console.log(`Teachers matched: ${teachers.length} of ${teacherEmails.length} requested.`)
  console.log(`Roster read: ${students.length} students. Game accounts created: ${created}, updated: ${updated}.`)
  console.log(resetPasswords || created > 0 ? `New/reset accounts use game password: ${password}` : 'Existing passwords unchanged.')
} catch (err) {
  await play.query('rollback').catch(() => {})
  console.error('Provisioning failed:', err.message)
  process.exitCode = 1
} finally {
  await exam.end()
  await play.end()
}
