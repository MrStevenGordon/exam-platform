// Gets the TEST school ready for a live session: every test account sees its first-visit tutorial again (Smart Assess and Smart Learning), students are not
// stuck "signed in on another device", and (unless you say otherwise) the staff accounts have NO authenticator yet, so each person sets theirs up on screen
// the first time they sign in, exactly as a real teacher would.
//
// Usage (a dry run first: it only says what it would do):
//   node scripts/qa-meeting-reset.mjs
//   node scripts/qa-meeting-reset.mjs --apply --project <project ref>               tutorials + student locks + remove the staff authenticators
//   node scripts/qa-meeting-reset.mjs --apply --project <project ref> --keep-2fa    tutorials + student locks only (keeps the codes that qa-totp.mjs makes)
// To put the automatic codes back for testing afterwards: node scripts/dev-test-school.mjs --apply --project <project ref>
//
// Test project only. It refuses to run unless the project ref matches, and it only touches the test accounts (Testing ... staff and students 54321 to 54402).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env.local') })
const args = process.argv.slice(2)
const apply = args.includes('--apply'), keep2fa = args.includes('--keep-2fa')
const project = args.includes('--project') ? args[args.indexOf('--project') + 1] : null
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local'); process.exit(1) }
const ref = new URL(url).hostname.split('.')[0]
console.log(`Project: ${ref}   Mode: ${apply ? 'APPLY' : 'dry run (nothing is changed)'}${keep2fa ? '   (keeping the staff authenticators)' : ''}`)
if (apply && project !== ref) { console.error(`Refusing: add  --project ${ref}  to confirm this is the TEST project.`); process.exit(1) }
const admin = createClient(url, key, { auth: { persistSession: false } })

const STAFF = ['testing.teacher', 'testing.hod', 'testing.principal', 'testing.admin', 'testing.english', 'testing.science'].map((k) => `${k}@mhs.smartassess`)
const { data: staff } = await admin.from('profiles').select('id, full_name').in('full_name', ['Testing Teacher', 'Testing HOD', 'Testing Principal', 'Testing Admin', 'Testing English Teacher', 'Testing Science Teacher'])
const { data: students } = await admin.from('profiles').select('id, student_id').eq('role', 'student').gte('student_id', '54321').lte('student_id', '54402')
const ids = [...(staff ?? []), ...(students ?? [])].map((p) => p.id)
console.log(`Test accounts found: ${staff?.length ?? 0} staff, ${students?.length ?? 0} students.`)
if (!apply) { console.log('\nDry run only. Re-run with --apply --project ' + ref); process.exit(0) }

// 1. the first-visit tutorials show again
const { error: tourErr } = await admin.from('profiles').update({ onboarding_tours_seen: {} }).in('id', ids)
console.log(tourErr ? `Tutorials: FAILED ${tourErr.message}` : `Tutorials reset for ${ids.length} accounts (Smart Assess and Smart Learning show on the next visit).`)
// 2. no student is stuck signed in somewhere else
const { error: lockErr } = await admin.from('profiles').update({ active_login_token: null, active_login_started_at: null, active_login_last_seen_at: null }).in('id', (students ?? []).map((s) => s.id))
console.log(lockErr ? `Student locks: FAILED ${lockErr.message}` : 'Student sign-in locks released.')
// 3. the staff authenticators
if (!keep2fa) {
  let removed = 0
  for (const p of staff ?? []) {
    const { data } = await admin.auth.admin.mfa.listFactors({ userId: p.id })
    for (const f of data?.factors ?? []) { const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: p.id, id: f.id }); if (!error) removed++ }
  }
  const file = path.join(ROOT, '.qa-totp.json')
  if (fs.existsSync(file)) fs.writeFileSync(file, '{}\n', { mode: 0o600 })
  console.log(`Authenticators removed: ${removed}. The next staff sign-in shows the set-up screen with a QR code.`)
}
