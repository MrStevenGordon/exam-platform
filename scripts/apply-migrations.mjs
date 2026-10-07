// Brings a TEST copy of the database up to date by running the school migrations in order (scripts/migrations/*.sql, not the rollback or central ones).
//
// How it decides: the whole run is one transaction, each file inside its own savepoint. A migration that fails because its objects already exist is treated as already applied and
// skipped (the whole file is undone, so nothing is half applied). Anything else that fails is reported and the run stops.
//
// Add  --from 060  to start at a later file (a copy cloned from a school already has the early ones), or  --only 093  for a single file.
// Usage (a dry run first: every file is tried and then undone, nothing is kept):
//   node scripts/apply-migrations.mjs --env .env.local
// Then, when the list looks right:
//   node scripts/apply-migrations.mjs --env .env.local --apply --project <project ref>
//
// The env file needs DATABASE_URL. --project must match the project ref in that URL, so the wrong database can never be changed by accident.
// NEVER point this at a live school (Manchester). It is for the test project only; live schools get one migration at a time, by hand.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null }
const envFile = flag('--env') && flag('--env') !== true ? flag('--env') : path.join(__dirname, '..', '.env.local')
const apply = args.includes('--apply')
const project = flag('--project')
const from = flag('--from') && flag('--from') !== true ? String(flag('--from')) : null     // start at the first file whose name is at or after this (e.g. 060)
const only = flag('--only') && flag('--only') !== true ? String(flag('--only')) : null     // run just the files whose name starts with this (e.g. 093)

dotenv.config({ path: path.resolve(envFile) })
const url = process.env.DATABASE_URL
if (!url) { console.error(`Missing DATABASE_URL in ${envFile}`); process.exit(1) }
const ref = decodeURIComponent(new URL(url).username).split('.')[1] || new URL(url).hostname.split('.')[0]
console.log(`Project: ${ref}   Mode: ${apply ? 'APPLY (changes are kept)' : 'dry run (every file is undone)'}`)
if (apply && project !== ref) { console.error(`Refusing to apply: add  --project ${ref}  to confirm this is the test project you mean to change.`); process.exit(1) }

const dir = path.join(__dirname, 'migrations')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => !from || f >= from).filter((f) => !only || f.startsWith(only))

const ALREADY = new Set(['42P07', '42710', '42723', '42701', '42P06', '42P16'])   // relation / object / function / column / schema already exists, multiple primary keys
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

// One transaction for the whole run, with a savepoint per file: a file that is already in is undone on its own, later files see everything before
// them, and in apply mode the run is all or nothing (a failure keeps nothing).
let applied = 0, skipped = 0
await client.query('BEGIN')
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n')
  await client.query('SAVEPOINT one_file')
  try {
    await client.query(sql)
    await client.query('RELEASE SAVEPOINT one_file')
    applied++
    console.log(`  ${apply ? 'applied   ' : 'would apply'}  ${f}`)
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT one_file')
    const msg = String(err.message || err).split('\n')[0]
    if (ALREADY.has(err.code) || /already exists/i.test(msg)) { skipped++; console.log(`  already in  ${f}`); continue }
    console.log(`  FAILED      ${f}\n              ${err.code || ''} ${msg}${err.position ? ` (at character ${err.position})` : ''}\n\nNothing was kept.`)
    await client.query('ROLLBACK')
    await client.end()
    process.exit(1)
  }
}
await client.query(apply ? 'COMMIT' : 'ROLLBACK')
await client.end()
console.log(`\n${apply ? 'Applied' : 'Would apply'} ${applied}, already in ${skipped}.${apply ? '' : '  Dry run only: nothing was changed. Re-run with --apply --project ' + ref + '.'}`)
