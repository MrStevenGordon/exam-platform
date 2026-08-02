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
// Requires: pg_dump/psql v17+ (matching the Supabase server version) on PATH,
// or set PG_BIN_DIR to the directory containing them
// (e.g. /usr/local/opt/postgresql@17/bin on this machine).

import { execFileSync } from 'child_process'
import { randomBytes } from 'crypto'
import { writeFileSync, unlinkSync } from 'fs'
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

console.log('1/4 — Dumping schema from the source (template) project…')
const dumpPath = path.join(__dirname, '.tmp-school-schema.sql')
run(pgDump, [sourceUrl, '--schema-only', '--no-owner', '--no-privileges', '--schema=public', '-f', dumpPath])

console.log('2/4 — Applying schema to the new project…')
run(psql, [targetUrl, '-v', 'ON_ERROR_STOP=1', '-f', dumpPath])
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
