// Launch reset: clears ALL demo and test data from a school's database, keeping its configuration,
// so the school can start clean. Replaces the older reset-for-launch.mjs, which knew nothing about
// attendance, Smart Learning, the AI tutor, evidence, messages, lesson plans or report cards.
//
//   node scripts/launch-reset.mjs                                  dry run: shows exactly what would happen
//   node scripts/launch-reset.mjs --confirm --confirm-host <host>  really do it (host must match the database)
//
// Options
//   --keep-email a@b.com,c@d.com   also keep these accounts (the platform owner / system admin is always kept)
//   --keep-role admin,principal    also keep every account with these roles
//   --clear-terms                  also clear academic terms (kept by default: they are configuration)
//   --clear-storage                also delete uploaded question images, media and task submissions
//                                  (the school logo and app downloads are never touched)
//   --play                         also empty the Smart Play database (PLAY_DATABASE_URL);
//                                  needs --confirm-play-host <host> as well
//   --database-url <url>           use this database instead of DATABASE_URL (for rehearsals)
//
// SAFETY
//   * Everything runs in ONE transaction: if anything fails, nothing is changed.
//   * It refuses to run unless you type the database host it is about to change.
//   * Platform-owner data (school requests, pitch and NDA records, investor enquiries, waitlist, billing,
//     organisations) is never touched: it is not the school's data.
//   * Every table is classified below. A table with rows that is not on any list stops the run, so a
//     new table can never be silently wiped or silently left behind.
//   * TAKE A BACKUP FIRST (the dry run prints the command). This cannot be undone.
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true })

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const list = (n) => (value(n) ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

// ---- classification ------------------------------------------------------------------------------------

// The platform owner's own data. Never touched by a school reset.
export const PLATFORM = [
  'school_requests', 'school_subscriptions', 'organizations', 'organization_payments', 'organization_subscriptions',
  'org_exams', 'org_exam_questions', 'org_exam_responses', 'org_exam_sessions', 'org_requests',
  'org_respondent_fields', 'org_respondent_field_values', 'investor_inquiries', 'pitch_nda_acceptances',
  'waitlist_signups', 'platform_billing_settings', 'ocbn_demo_leaderboard',
]

// The school's configuration: kept, so the school does not have to set up again.
export const KEEP = ['school_settings', 'departments', 'department_subjects', 'class_groups', 'curriculum_topics', 'timetable_periods', 'academic_terms']

// People are handled separately (kept or deleted account by account), so `profiles` is not cleared as a table.
export const PEOPLE = ['profiles']

// Everything that is activity or demo content. Cleared (people are handled separately below).
export const CLEAR = [
  // exams
  'marking_point_responses', 'responses', 'exam_sessions', 'self_mock_questions', 'self_mocks',
  'draft_exam_class_groups', 'final_exam_class_groups', 'final_exam_questions', 'exam_sections', 'questions',
  'draft_exams', 'final_exams', 'peer_ratings', 'project_group_members', 'project_groups',
  // class and staff assignments
  'enrollments', 'teacher_class_groups', 'teacher_subjects', 'team_lead_appointments', 'senior_team_lead_appointments',
  'section_enrollments', 'timetable_sections',
  // lesson plans, report cards, messages, help chat, misc
  'lesson_plans', 'shared_lesson_plans', 'report_card_attendance', 'report_card_comments',
  'messages', 'conversation_participants', 'conversations', 'chat_messages', 'chat_conversations',
  'password_reset_requests', 'ai_polish_usage', 'rate_limits',
  // attendance and presence (migrations 055 to 057)
  'attendance_alert_reads', 'attendance_alerts', 'class_attendance', 'class_sessions', 'daily_attendance', 'user_presence',
  // Smart Learning (059 to 065)
  'learning_tutor_messages', 'learning_tutor_conversations', 'learning_catchup_overrides', 'learning_check_attempts',
  'learning_check_questions', 'learning_progress', 'learning_assignments', 'learning_lessons', 'student_evidence',
]

const CLEAR_STORAGE_BUCKETS = ['question-images', 'question-media', 'task-submissions']  // never school-logo or app-downloads

// ---- helpers --------------------------------------------------------------------------------------------

const q = (name) => `"${name.replace(/"/g, '""')}"`
const isLocal = (host) => /^(127\.0\.0\.1|localhost|::1)$/.test(host)
const hostOf = (url) => { try { return new URL(url).hostname } catch { return '' } }
const connect = async (url) => {
  const c = new pg.Client({ connectionString: url, ssl: isLocal(hostOf(url)) ? false : { rejectUnauthorized: false } })
  await c.connect()
  return c
}

async function countRows(c, table) {
  return (await c.query(`select count(*)::int n from public.${q(table)}`)).rows[0].n
}

export async function plan(c, opts) {
  const tables = (await c.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`)).rows.map((r) => r.relname)
  const known = new Set([...PLATFORM, ...KEEP, ...CLEAR, ...PEOPLE])
  const clearing = CLEAR.filter((t) => tables.includes(t) && !(opts.clearTerms === false && t === 'academic_terms'))
  if (opts.clearTerms && tables.includes('academic_terms')) clearing.push('academic_terms')
  const unclassified = tables.filter((t) => !known.has(t))
  const counts = {}
  for (const t of tables) counts[t] = await countRows(c, t)

  const people = (await c.query(`select p.id, p.full_name, p.role, coalesce(p.is_system_admin, false) as sys, lower(u.email) as email from public.profiles p left join auth.users u on u.id = p.id order by p.role, p.full_name`)).rows
  const keepEmails = new Set(opts.keepEmails), keepRoles = new Set(opts.keepRoles)
  const keep = people.filter((p) => p.sys || (p.email && keepEmails.has(p.email)) || keepRoles.has(p.role))
  const drop = people.filter((p) => !keep.includes(p))
  const orphanAuth = (await c.query(`select count(*)::int n from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)`)).rows[0].n
  return { tables, clearing, unclassified, counts, people, keep, drop, orphanAuth }
}

// ---- the reset ------------------------------------------------------------------------------------------

export async function reset(c, p) {
  const log = []
  await c.query('begin')
  try {
    // 1. Activity and demo content. All in one statement, without CASCADE: if anything outside this list
    //    still points at one of these tables, Postgres refuses and nothing is lost.
    if (p.clearing.length > 0) {
      await c.query(`truncate table ${p.clearing.map((t) => `public.${q(t)}`).join(', ')} restart identity`)
      log.push(`Cleared ${p.clearing.length} tables.`)
    }

    // 2. People. Kept tables that point at a person (for example who created a subject, or who heads a
    //    department) are set to empty first, wherever the column allows it.
    const dropIds = p.drop.map((x) => x.id)
    if (dropIds.length > 0) {
      const refs = (await c.query(`
        select cl.relname as tbl, a.attname as col, a.attnotnull as notnull
          from pg_constraint con
          join pg_class cl on cl.oid = con.conrelid
          join pg_namespace ns on ns.oid = cl.relnamespace
          join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
         where con.contype = 'f' and con.confrelid = 'public.profiles'::regclass and ns.nspname = 'public'
           and con.confdeltype in ('a', 'r') and cl.relname <> all($1::text[])`, [p.clearing])).rows
      for (const r of refs) {
        if (r.notnull) continue
        const res = await c.query(`update public.${q(r.tbl)} set ${q(r.col)} = null where ${q(r.col)} = any($1::uuid[])`, [dropIds])
        if (res.rowCount) log.push(`Emptied ${r.tbl}.${r.col} on ${res.rowCount} row(s).`)
      }
      await c.query('delete from public.profiles where id = any($1::uuid[])', [dropIds])
      await c.query('delete from auth.users where id = any($1::uuid[])', [dropIds])
      log.push(`Deleted ${dropIds.length} accounts (profile and login).`)
    }
    // Logins with no profile at all (left over from test sign-ups).
    const orphans = await c.query(`delete from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id) returning 1`)
    if (orphans.rowCount) log.push(`Deleted ${orphans.rowCount} logins that had no profile.`)
    await c.query('commit')
  } catch (e) {
    await c.query('rollback')
    throw e
  }
  return log
}

async function clearStorage(dryRun) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.log('  (storage skipped: no Supabase URL and key in .env.local)'); return }
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key)
  for (const bucket of CLEAR_STORAGE_BUCKETS) {
    const paths = []
    const walk = async (prefix) => {
      const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 })
      if (error) { console.log(`  ${bucket}: could not list (${error.message})`); return }
      for (const item of data || []) {
        if (item.id === null) await walk(prefix ? `${prefix}/${item.name}` : item.name)   // a folder
        else paths.push(prefix ? `${prefix}/${item.name}` : item.name)
      }
    }
    await walk('')
    if (dryRun) { console.log(`  ${bucket}: ${paths.length} file(s) would be deleted`); continue }
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await sb.storage.from(bucket).remove(paths.slice(i, i + 100))
      if (error) console.log(`  ${bucket}: FAILED (${error.message})`)
    }
    console.log(`  ${bucket}: ${paths.length} file(s) deleted`)
  }
}

async function playReset(dryRun, confirmHost) {
  const url = process.env.PLAY_DATABASE_URL
  if (!url) { console.log('  (Smart Play skipped: PLAY_DATABASE_URL is not set)'); return }
  const host = hostOf(url)
  const c = await connect(url)
  try {
    const tables = (await c.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and relname like 'play\\_%' order by 1`)).rows.map((r) => r.relname)
    let total = 0
    for (const t of tables) total += await countRows(c, t)
    console.log(`  Smart Play database at ${host}: ${tables.length} tables, ${total} rows`)
    if (dryRun) { console.log('  (would be emptied, accounts included)'); return }
    if (confirmHost !== host) { console.log(`  NOT emptied: --confirm-play-host must be exactly "${host}".`); return }
    if (tables.length) await c.query(`truncate table ${tables.map((t) => `public.${q(t)}`).join(', ')} restart identity cascade`)
    console.log('  Smart Play database emptied.')
  } finally { await c.end() }
}

// ---- main -------------------------------------------------------------------------------------------------

async function main() {
  const url = value('--database-url') || process.env.DATABASE_URL
  if (!url) { console.error('No database: set DATABASE_URL in .env.local or pass --database-url.'); process.exit(1) }
  const host = hostOf(url)
  const confirmed = flag('--confirm')
  const opts = { keepEmails: list('--keep-email'), keepRoles: list('--keep-role'), clearTerms: flag('--clear-terms') }

  const c = await connect(url)
  try {
    const p = await plan(c, opts)
    console.log(`\nLaunch reset for the database at: ${host}\n`)
    console.log('Will be CLEARED (rows now):')
    for (const t of p.clearing) console.log(`  ${String(p.counts[t]).padStart(6)}  ${t}`)
    console.log('\nWill be KEPT (school configuration):')
    for (const t of KEEP.filter((t) => p.tables.includes(t) && !(opts.clearTerms && t === 'academic_terms'))) console.log(`  ${String(p.counts[t]).padStart(6)}  ${t}`)
    const platformNow = PLATFORM.filter((t) => p.tables.includes(t))
    console.log(`\nNEVER touched (platform owner data): ${platformNow.map((t) => `${t} (${p.counts[t]})`).join(', ')}`)

    console.log(`\nAccounts: ${p.people.length} in total (+${p.orphanAuth} login(s) with no profile)`)
    console.log(`  KEEP   ${p.keep.length}: ${p.keep.map((x) => `${x.full_name} [${x.role}${x.sys ? ', system admin' : ''}]`).join('; ') || '(none)'}`)
    const byRole = {}
    for (const x of p.drop) byRole[x.role] = (byRole[x.role] || 0) + 1
    console.log(`  DELETE ${p.drop.length}: ${Object.entries(byRole).map(([r, n]) => `${n} ${r}`).join(', ') || '(none)'}`)

    if (flag('--clear-storage')) { console.log('\nStorage:'); await clearStorage(!confirmed) }
    if (flag('--play')) { console.log('\nSmart Play:'); await playReset(!confirmed, value('--confirm-play-host')) }

    if (p.unclassified.some((t) => p.counts[t] > 0)) {
      console.error(`\nSTOPPED: these tables have data but are not classified in this script: ${p.unclassified.filter((t) => p.counts[t] > 0).join(', ')}.`)
      console.error('Add each to KEEP, CLEAR or PLATFORM in scripts/launch-reset.mjs, then run again.')
      process.exit(2)
    }

    if (!confirmed) {
      console.log('\n--- DRY RUN: nothing was changed ---')
      console.log('1. Take a backup first, for example:')
      console.log(`   pg_dump "${url.replace(/:[^:@/]+@/, ':****@')}" --data-only -Fc -f backup-before-launch-reset.dump`)
      console.log(`2. Then run again with:  --confirm --confirm-host ${host}`)
      return
    }
    if (value('--confirm-host') !== host) {
      console.error(`\nSTOPPED: to run this for real, add  --confirm-host ${host}  (the database that will be changed).`)
      process.exit(3)
    }
    const log = await reset(c, p)
    console.log('\nDONE')
    log.forEach((l) => console.log('  ' + l))
    console.log('\nNext: node scripts/launch-verify.mjs')
  } finally {
    await c.end()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('\nFAILED (nothing was changed):', e.message); process.exit(1) })
}
