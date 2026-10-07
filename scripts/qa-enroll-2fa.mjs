// Gives chosen TEST staff accounts an automatic authenticator (the secret goes to .qa-totp.json, git-ignored) so a test can sign in and a code is available
// from `node scripts/qa-totp.mjs <name>`. Accounts that already have a verified authenticator are left alone (so a phone someone set up stays valid).
// Usage: node scripts/qa-enroll-2fa.mjs --apply --project <ref> testing.english testing.teacher
// Before a live session run scripts/qa-meeting-reset.mjs to remove them again.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { totp } from './lib/totp.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
const args = process.argv.slice(2)
const apply = args.includes('--apply'); const project = args.includes('--project') ? args[args.indexOf('--project') + 1] : null
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--project')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = new URL(url).hostname.split('.')[0]
if (!apply || project !== ref || names.length === 0) { console.log(`Dry run (or missing --apply --project ${ref} or names). Would enrol: ${names.join(', ') || '(none given)'}`); process.exit(0) }
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const file = path.join(ROOT, '.qa-totp.json'); const secrets = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
for (const n of names) {
  const email = `${n.replace(/@.*$/, '')}@mhs.smartassess`
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 }); const user = list.users.find((u) => u.email === email)
  if (!user) { console.log(`${email}: no such account`); continue }
  const { data: f } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
  if ((f?.factors ?? []).some((x) => x.status === 'verified')) { console.log(`${email}: already has a verified authenticator, left alone`); continue }
  for (const x of f?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: x.id })
  const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD }); if (se) throw se
  const { data: enr, error: ee } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'qa' }); if (ee) throw ee
  const { data: ch } = await c.auth.mfa.challenge({ factorId: enr.id })
  const { error: ve } = await c.auth.mfa.verify({ factorId: enr.id, challengeId: ch.id, code: totp(enr.totp.secret) }); if (ve) throw ve
  secrets[email] = enr.totp.secret; console.log(`${email}: authenticator set up for testing`)
}
fs.writeFileSync(file, JSON.stringify(secrets, null, 2) + '\n', { mode: 0o600 })
