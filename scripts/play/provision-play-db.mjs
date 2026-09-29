// Applies scripts/play/001 through 012 (the whole Play schema, with hosted hardening) to a
// brand-new Supabase project in one shot, then runs the same lock-down check check_hosted.mjs
// does — instead of pasting 12 files into the SQL editor by hand, one at a time.
//
// Usage:
//   node scripts/play/provision-play-db.mjs --database-url "<the new project's DIRECT connection string>"
//   node scripts/play/provision-play-db.mjs --database-url "..." --seed-questions   (also loads a
//     starter Topic Mastery question bank — original content, not copied from any school's exams,
//     safe to re-run — so the pilot has something to play on day one)
//
// All 12 files run inside a single transaction: a failure partway leaves the target untouched.
// Refuses to run against a database that looks like the exam schema (has a `profiles` table), and
// refuses to re-run destructively over a project that already has real Play accounts.
//
// Requires: the `pg` package (already a project dependency).

import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { checkCatalog } from './check_hosted.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const seedQuestions = args.includes('--seed-questions')

const url = val('--database-url') || process.env.TARGET_DATABASE_URL
if (!url) {
  console.error('Give --database-url "<connection string>" (the new Play project\'s DIRECT connection, not the pooler — this needs to run DDL).')
  process.exit(1)
}

const local = /@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url)
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } })

async function tableExists(name) {
  const { rows } = await client.query(
    `select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = $1) as e`,
    [name]
  )
  return rows[0].e
}

async function main() {
  await client.connect()

  if (await tableExists('profiles') || await tableExists('exam_sessions')) {
    console.error('This looks like the EXAM database (it has a profiles/exam_sessions table). Refusing — Play must never share a database with exam data. Point --database-url at the new, separate Play project.')
    process.exit(1)
  }

  if (await tableExists('play_accounts')) {
    const { rows } = await client.query('select count(*)::int n from play_accounts')
    if (rows[0].n > 0) {
      console.error(`Refusing: this project already has ${rows[0].n} Play account(s). This script is for a brand-new, empty Play project only — re-running the schema over real student data is not something to automate.`)
      process.exit(1)
    }
    console.log('Play tables already exist here but hold no accounts (probably a half-finished earlier attempt) — re-applying. Every file uses "if not exists", so this is safe.')
  }

  const files = readdirSync(__dirname)
    .filter((f) => /^0(0[1-9]|1[0-2])_.*\.sql$/.test(f))
    .sort()
  if (files.length !== 12) {
    console.error(`Expected files 001 through 012 in scripts/play/, found ${files.length}: ${files.join(', ')}`)
    process.exit(1)
  }

  console.log(`Applying ${files.length} files in one transaction:\n  ${files.join('\n  ')}`)
  await client.query('begin')
  try {
    for (const f of files) {
      const sql = readFileSync(path.join(__dirname, f), 'utf8')
      await client.query(sql)
    }
    if (seedQuestions) {
      console.log('Loading the starter Topic Mastery question bank...')
      await client.query(readFileSync(path.join(__dirname, 'seed_topic_mastery_questions.sql'), 'utf8'))
    }
    await client.query('commit')
  } catch (e) {
    await client.query('rollback').catch(() => {})
    console.error('FAILED applying schema, rolled back — the target is untouched:', e.message)
    process.exit(1)
  }
  console.log('Schema applied.\n')

  console.log('Checking the database is closed to everyone except the server...')
  await client.query('begin read only')
  const result = await checkCatalog(client)
  await client.query('rollback')
  console.log(`Play database: ${result.tables.length} tables, ${result.functions.length} functions. Public roles present: ${result.rolesPresent.join(', ') || 'none'}.`)
  if (result.problems.length === 0) {
    console.log('PASS: nothing in the Play database is reachable except by the server.\n')
  } else {
    console.log(`FAIL: ${result.problems.length} problem(s) — do not go further until this is a clean PASS:`)
    for (const p of result.problems.slice(0, 60)) console.log('  - ' + p)
  }

  await client.end()

  console.log('Next, in Vercel (Production and Preview), set:')
  console.log('  PLAY_DATABASE_URL      = this project\'s POOLER address, transaction mode, port 6543 (not the direct URL used above)')
  console.log('  PLAY_SESSION_SECRET    = a new random string, 32+ characters')
  console.log('  NEXT_PUBLIC_SCHOOL_NAME = the school\'s name as it should show in Play')
  console.log('Then step 4 of docs/play-pilot-guide.md (the public-API half of this same check, with --api-url and --public-key) once those are set.')
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
