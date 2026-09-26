// Launch check: a read-only report on whether a school's database is ready to hand over. It changes nothing.
//
//   node scripts/launch-verify.mjs                       report on DATABASE_URL
//   node scripts/launch-verify.mjs --school manchester   also check Manchester High's classes
//   node scripts/launch-verify.mjs --expect-clean        treat leftover demo data as a failure (run after launch-reset)
//   node scripts/launch-verify.mjs --url https://exam-platform-chi.vercel.app   also check the live site responds
//   node scripts/launch-verify.mjs --database-url <url>  use another database
//
// Each line is PASS, WARN (look at it) or FAIL (fix it). Exit code 1 if anything FAILS.
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'
import { CLEAR } from './launch-reset.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true })

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }

// What each migration adds. Used to tell which have been applied. A migration counts as applied
// when every item listed here exists.
export const MIGRATIONS = [
  { id: '055', name: 'Principal role and attendance', tables: ['daily_attendance', 'class_sessions', 'class_attendance'], functions: ['start_class', 'mark_class_attendance'] },
  { id: '056', name: 'Attendance alerts and HOD scope', tables: ['attendance_alerts', 'attendance_alert_reads'], functions: ['refresh_attendance_alerts'] },
  { id: '057', name: 'Online presence', tables: ['user_presence'], functions: ['presence_heartbeat'] },
  { id: '058', name: 'Shared topic list', tables: ['curriculum_topics'], functions: ['merge_topics'] },
  { id: '059', name: 'Smart Learning lessons', tables: ['learning_lessons', 'learning_assignments', 'learning_progress'], functions: ['learning_publish', 'learning_get_lesson'] },
  { id: '060', name: 'Check questions and evidence', tables: ['student_evidence', 'learning_check_questions', 'learning_check_attempts'], functions: ['learning_submit_check', 'record_evidence'] },
  { id: '061', name: 'Lesson topic for the Play link', tables: [], functions: [], sourceContains: ['learning_get_lesson', 'v_topic'] },
  { id: '062', name: 'Catch-up for absent students', tables: ['learning_catchup_overrides'], functions: ['learning_catchup', 'learning_student_catchup'] },
  { id: '063', name: 'Curriculum coverage', tables: [], functions: ['learning_coverage', 'learning_coverage_subjects'] },
  { id: '064', name: 'AI tutor conversations', tables: ['learning_tutor_conversations', 'learning_tutor_messages'], functions: ['learning_tutor_conversations', 'learning_tutor_transcript'] },
  { id: '065', name: 'Flagged tutor list', tables: [], functions: ['learning_tutor_flagged', 'learning_tutor_flagged_counts'] },
  { id: '066', name: 'Exam integrity: server marking and hidden answers', tables: [], functions: ['student_submit_exam', 'student_exam_questions', 'student_exam_review', 'student_exam_meta', 'score_answer'] },
  // 067 is applied only after the new app is live (see docs/exam-integrity-findings.md), so it is reported separately below.
]

// Applied last and on purpose: only after 066 and the matching app update are live.
export const LOCK_MIGRATION = { id: '067', name: 'Exam integrity: student write lock', functions: ['exam_session_start_problem', 'exam_sessions_student_guard', 'responses_student_guard'] }

export function manchesterClasses() {
  const names = []
  const sizes = { 1: 7, 2: 7, 3: 8, 4: 7, 5: 7 }
  for (const f of [1, 2, 3, 4, 5]) for (let n = 1; n <= sizes[f]; n++) names.push(`${f}-${n}`)
  for (const l of ['B', 'A']) for (let n = 1; n <= 3; n++) names.push(`6${l}${n}`)
  return names
}

const results = []
const add = (level, msg) => { results.push({ level, msg }); console.log(`${level.padEnd(5)} ${msg}`) }

async function main() {
  const url = value('--database-url') || process.env.DATABASE_URL
  if (!url) { console.error('No database: set DATABASE_URL in .env.local or pass --database-url.'); process.exit(1) }
  const host = new URL(url).hostname
  const local = /^(127\.0\.0\.1|localhost|::1)$/.test(host)
  const c = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })
  await c.connect()
  await c.query('begin read only')
  try {
    console.log(`\nLaunch check for the database at ${host}\n`)

    // ---- migrations
    console.log('Updates applied:')
    const tables = new Set((await c.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`)).rows.map((r) => r.relname))
    const fns = new Map((await c.query(`select p.proname, string_agg(p.prosrc, ' ') as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' group by p.proname`)).rows.map((r) => [r.proname, r.src]))
    let firstMissing = null
    for (const m of MIGRATIONS) {
      const missing = [...m.tables.filter((t) => !tables.has(t)).map((t) => `table ${t}`), ...m.functions.filter((f) => !fns.has(f)).map((f) => `function ${f}`)]
      if (m.sourceContains && !m.sourceContains.slice(1).every((s) => (fns.get(m.sourceContains[0]) ?? '').includes(s))) missing.push(`${m.sourceContains[0]} update`)
      if (missing.length === 0) add('PASS', `${m.id} ${m.name}`)
      else { add('FAIL', `${m.id} ${m.name}: not applied (missing ${missing.join(', ')})`); firstMissing ??= m.id }
    }
    if (firstMissing) console.log(`      Apply the missing updates in order, starting with ${firstMissing}, before going further.`)
    {
      const missing = LOCK_MIGRATION.functions.filter((f) => !fns.has(f))
      if (missing.length === 0) add('PASS', `${LOCK_MIGRATION.id} ${LOCK_MIGRATION.name}`)
      else if (missing.length < LOCK_MIGRATION.functions.length) add('FAIL', `${LOCK_MIGRATION.id} ${LOCK_MIGRATION.name}: only partly applied (missing ${missing.join(', ')})`)
      else add(firstMissing ? 'INFO' : 'WARN', `${LOCK_MIGRATION.id} ${LOCK_MIGRATION.name}: not applied yet${firstMissing ? '' : ' (apply after the new app is live and a test exam has been checked; students can still read exam answers until it is)'}`)
    }

    // ---- people
    console.log('\nPeople:')
    const people = (await c.query(`select role, count(*)::int n, count(*) filter (where is_system_admin)::int sys, count(*) filter (where coalesce(is_active, true) = false)::int inactive from public.profiles group by role order by role`)).rows
    const total = people.reduce((s, r) => s + r.n, 0)
    const sysAdmins = people.reduce((s, r) => s + r.sys, 0)
    add(sysAdmins >= 1 ? 'PASS' : 'FAIL', `${sysAdmins} platform owner (system admin) account(s)`)
    add('INFO', `${total} accounts: ${people.map((r) => `${r.n} ${r.role}`).join(', ') || 'none'}`)
    const orphan = (await c.query(`select count(*)::int n from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)`)).rows[0].n
    add(orphan === 0 ? 'PASS' : 'WARN', orphan === 0 ? 'every login has a profile' : `${orphan} login(s) have no profile (left over from test sign-ups)`)

    // ---- leftover demo data
    console.log('\nDemo and test data:')
    const leftovers = []
    for (const t of CLEAR) if (tables.has(t)) { const n = (await c.query(`select count(*)::int n from public."${t}"`)).rows[0].n; if (n > 0) leftovers.push(`${t} (${n})`) }
    const expectClean = flag('--expect-clean')
    if (leftovers.length === 0) add('PASS', 'no activity or demo rows in any table')
    else add(expectClean ? 'FAIL' : 'INFO', `rows present in: ${leftovers.join(', ')}${expectClean ? ' (run scripts/launch-reset.mjs)' : ''}`)

    // ---- configuration
    console.log('\nSchool configuration:')
    const settings = (await c.query(`select * from public.school_settings limit 1`)).rows[0]
    if (!settings) add('FAIL', 'no school_settings row (the school has not been provisioned)')
    else {
      const f = settings.enabled_features ?? {}
      add('PASS', 'school settings present')
      add(settings.subscription_active === false ? 'FAIL' : 'PASS', `subscription ${settings.subscription_active === false ? 'is INACTIVE (nobody can sign in)' : 'active'}${settings.subscription_expires_at ? `, expires ${new Date(settings.subscription_expires_at).toISOString().slice(0, 10)}` : ''}`)
      const exp = settings.subscription_expires_at ? new Date(settings.subscription_expires_at) : null
      if (exp && exp < new Date()) add('FAIL', 'the subscription has EXPIRED')
      add('INFO', `switches: Smart Learning ${f.smart_learning_enabled ? 'ON' : 'off'}, AI tutor ${f.ai_tutor_enabled ? 'ON' : 'off'}, Smart Play ${f.smart_play_enabled ? 'ON' : 'off'}`)
      if (f.ai_tutor_enabled && !f.smart_learning_enabled) add('WARN', 'the AI tutor is on but Smart Learning is off, so the tutor will not appear')
    }
    const classes = (await c.query(`select name, year_grade from public.class_groups order by name`)).rows
    add(classes.length > 0 ? 'PASS' : 'FAIL', `${classes.length} classes`)
    if (flag('--school') && value('--school')?.toLowerCase() === 'manchester') {
      const want = manchesterClasses(), have = new Set(classes.map((x) => x.name))
      const missing = want.filter((n) => !have.has(n)), extra = classes.map((x) => x.name).filter((n) => !want.includes(n))
      add(missing.length === 0 ? 'PASS' : 'FAIL', missing.length === 0 ? 'all 42 Manchester High classes exist' : `missing classes: ${missing.join(', ')}`)
      if (extra.length) add('WARN', `classes that are not on Manchester's list: ${extra.join(', ')}`)
      const sixth = classes.filter((x) => /^6[AB]\d$/.test(x.name) && x.year_grade !== 'Grade 12')
      if (sixth.length) add('WARN', `sixth-form classes not marked Grade 12: ${sixth.map((x) => x.name).join(', ')}`)
    }
    const depts = (await c.query(`select count(*)::int n from public.departments`)).rows[0].n
    const subjects = (await c.query(`select count(*)::int n from public.department_subjects`)).rows[0].n
    add(depts > 0 && subjects > 0 ? 'PASS' : 'WARN', `${depts} department(s), ${subjects} department subject(s)`)
    if (tables.has('curriculum_topics')) {
      const t = (await c.query(`select grade, count(*)::int n from public.curriculum_topics where status = 'active' group by grade order by grade`)).rows
      add(t.length > 0 ? 'PASS' : 'WARN', t.length > 0 ? `topic list: ${t.map((r) => `Grade ${r.grade}: ${r.n}`).join(', ')}` : 'the topic list is empty (Smart Learning coverage and Play links need topics)')
    }

    // ---- storage
    const buckets = (await c.query(`select b.name, (select count(*)::int from storage.objects o where o.bucket_id = b.id) n from storage.buckets b order by 1`).catch(() => ({ rows: [] }))).rows
    if (buckets.length) {
      console.log('\nStorage:')
      for (const b of buckets) {
        const demo = ['question-images', 'question-media', 'task-submissions'].includes(b.name)
        add(demo && b.n > 0 && expectClean ? 'WARN' : 'INFO', `${b.name}: ${b.n} file(s)${demo && b.n > 0 ? ' (uploads: cleared by launch-reset --clear-storage)' : ''}`)
      }
    }
  } finally {
    await c.query('rollback').catch(() => {})
    await c.end()
  }

  // ---- the live site
  const site = value('--url')
  if (site) {
    console.log(`\nLive site ${site}:`)
    for (const [p, ok] of [['/', [200]], ['/login', [200]], ['/api/learning/tutor', [405]], ['/api/play/topics', [401, 404]]]) {
      try {
        const res = await fetch(site + p, { redirect: 'follow' })
        add(ok.includes(res.status) ? 'PASS' : 'WARN', `${p} answered ${res.status}`)
      } catch (e) { add('FAIL', `${p} could not be reached (${e.message})`) }
    }
  }

  const fails = results.filter((r) => r.level === 'FAIL').length, warns = results.filter((r) => r.level === 'WARN').length
  console.log(`\n${fails === 0 ? 'READY' : 'NOT READY'}: ${fails} failure(s), ${warns} warning(s).`)
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
