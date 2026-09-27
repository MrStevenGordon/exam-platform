// Provisions a brand-new (empty) Supabase project as a new school's own
// isolated environment: clones the current schema from Manchester High
// (the source of truth), replicates storage buckets, and seeds a one-time
// setup token the school uses to self-register their first admin account
// via /school-setup/[token] — this deliberately avoids auth.admin.createUser(),
// which doesn't work with this project's Supabase key format.
//
// Usage:
//   TARGET_DATABASE_URL=postgresql://... DEPLOYMENT_URL=https://newschool.example.com \
//     node scripts/provision-school-db.mjs
//
// If a previous attempt stopped half way, the new project holds a partial copy. Re-run with RESET_TARGET=1 to
// clear it first (drops and recreates the target's public schema). That is refused unless the target is a
// different project from the template AND has no user accounts.
//
// Requires: pg_dump/psql v17+ (matching the Supabase server version) on PATH,
// or set PG_BIN_DIR to the directory containing them
// (e.g. /usr/local/opt/postgresql@17/bin on this machine).

import { execFileSync } from 'child_process'
import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const sourceUrl = process.env.DATABASE_URL
const targetUrl = process.env.TARGET_DATABASE_URL
const deploymentUrl = process.env.DEPLOYMENT_URL

if (!sourceUrl) {
  console.error('DATABASE_URL (source/template project) not found in .env.local.')
  process.exit(1)
}
if (!targetUrl) {
  console.error('Set TARGET_DATABASE_URL to the new (empty) school project\'s connection string.')
  process.exit(1)
}
if (!deploymentUrl) {
  console.error('Set DEPLOYMENT_URL to the new school\'s Vercel deployment URL (e.g. https://newschool.vercel.app).')
  process.exit(1)
}

const binDir = process.env.PG_BIN_DIR || '/usr/local/opt/postgresql@17/bin'
const pgDump = path.join(binDir, 'pg_dump')
const psql = path.join(binDir, 'psql')

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 })
}

// The Supabase project a connection string points at: "postgres.<ref>" (pooler) or "db.<ref>.supabase.co" (direct).
function projectRef(url) {
  try {
    const u = new URL(url)
    const fromUser = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]+)$/)
    if (fromUser) return fromUser[1]
    const fromHost = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)
    return fromHost ? fromHost[1] : null
  } catch {
    return null
  }
}

const sourceRef = projectRef(sourceUrl)
const targetRef = projectRef(targetUrl)
if (sourceUrl === targetUrl || (sourceRef && targetRef && sourceRef === targetRef)) {
  console.error('TARGET_DATABASE_URL points at the same project as the template (DATABASE_URL). Refusing: it must be the NEW school\'s project.')
  process.exit(1)
}

// What the target holds before we touch it.
const query = (sql) => run(psql, [targetUrl, '-v', 'ON_ERROR_STOP=1', '-Atc', sql]).trim()
const existing = Number(query("select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v','m','S','p')"))
const existingFunctions = Number(query("select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"))
if (existing > 0 || existingFunctions > 0) {
  const users = Number(query('select count(*) from auth.users'))
  if (process.env.RESET_TARGET !== '1') {
    console.error(`The target project's public schema is not empty (${existing} tables/views/sequences, ${existingFunctions} functions), probably from an earlier attempt that stopped half way.`)
    console.error('If this really is the NEW, empty school project, run again with RESET_TARGET=1 to clear it first.')
    process.exit(1)
  }
  if (users > 0) {
    console.error(`Refusing to reset: the target has ${users} user account(s), so it is not a fresh project.`)
    process.exit(1)
  }
  console.log(`0/4 — Clearing the half-built copy in the target (${existing} tables/views/sequences, ${existingFunctions} functions, no user accounts)…`)
  run(psql, [targetUrl, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-c', `
    drop schema public cascade;
    create schema public;
    comment on schema public is 'standard public schema';
    grant usage on schema public to postgres, anon, authenticated, service_role;
    grant create on schema public to postgres, service_role;
    alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
  `])
}

console.log('1/4 — Dumping schema from the source (template) project…')
const dumpPath = path.join(__dirname, '.tmp-school-schema.sql')
run(pgDump, [sourceUrl, '--schema-only', '--no-owner', '--no-privileges', '--schema=public', '-f', dumpPath])

// Newer pg_dump versions write "CREATE SCHEMA public;", but every Supabase project already has that schema.
writeFileSync(dumpPath, readFileSync(dumpPath, 'utf8').replace(/^CREATE SCHEMA public;$/m, 'CREATE SCHEMA IF NOT EXISTS public;'))

console.log('2/4 — Applying schema to the new project…')
// All or nothing: a failure part way leaves the target untouched.
run(psql, [targetUrl, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', dumpPath])
unlinkSync(dumpPath)

console.log('3/4 — Replicating storage buckets…')
const bucketsSql = `
  insert into storage.buckets (id, name, public)
  values
    ('question-images', 'question-images', true),
    ('question-media', 'question-media', true),
    ('school-logo', 'school-logo', true),
    ('task-submissions', 'task-submissions', true)
  on conflict (id) do nothing;
`
run(psql, [targetUrl, '-v', 'ON_ERROR_STOP=1', '-c', bucketsSql])

// The rules for who may upload to those buckets live in the storage schema, which the structure copy above does
// not include; without them every upload (the school logo, question images, task submissions) is refused.
run(psql, [targetUrl, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', path.join(__dirname, 'data', 'school-storage-policies.sql')])

console.log('4/4 — Seeding setup token…')
const setupToken = randomBytes(24).toString('base64url')
run(psql, [targetUrl, '-v', 'ON_ERROR_STOP=1', '-c',
  `insert into public.school_settings (setup_token) values ('${setupToken}');`])

console.log('\nBefore sending the link — in the NEW project\'s Supabase dashboard:')
console.log('  Authentication → Sign In / Providers → Email → turn OFF "Confirm email"')
console.log('  (new projects default this ON, which would break the bootstrap signup)\n')

console.log('Done. Bootstrap link for this school\'s first admin:\n')
console.log(`${deploymentUrl}/school-setup/${setupToken}\n`)
console.log('Paste this into the owner queue\'s "Setup link" field to email it.')
