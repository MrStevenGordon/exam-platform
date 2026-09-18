// One-way roster provisioning: copies student ID#, name and grade from the
// exam database (READ ONLY) into game accounts in the Play database.
// Nothing is ever written to the exam database. Re-running is safe: existing
// accounts keep their password unless --reset-passwords is passed.
//
//   node scripts/play/provision_from_roster.mjs [--password smart.play] [--reset-passwords]
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local', quiet: true })

const args = process.argv.slice(2)
const pwIdx = args.indexOf('--password')
const password = pwIdx >= 0 ? args[pwIdx + 1] : 'smart.play'
const resetPasswords = args.includes('--reset-passwords')
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
  await play.query('commit')
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
