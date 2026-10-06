// Gives every student whose ID is not a 5-digit number (for example 1-1-1) a new, random, unique 5-digit ID.
// A student's sign-in email is "<id>@mhs.smartassess", so each change updates the profile AND the sign-in email together,
// the same way the app's own "update-student-id" route does, and puts the old ID back if the second step fails.
//
// It does NOT delete or re-upload anyone: names, classes, results and passwords stay exactly as they are.
// The student with ID 54321 (the test student) and anyone who already has a 5-digit ID are left alone.
//
// Usage (dry run first: it changes nothing and writes a mapping file):
//   node scripts/reassign-student-ids.mjs --env .env.manchester
// Then, when you are happy with the mapping file:
//   node scripts/reassign-student-ids.mjs --env .env.manchester --apply --project hmcpfgtfvgatsddfueqe
//
// The env file needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for the school you want to change. --project must match
// the project ref in that URL, so the wrong database can never be changed by accident.
// Students will need to sign in with their new ID (new-id@mhs.smartassess). Their password does not change.

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null }
const envFile = flag('--env') && flag('--env') !== true ? flag('--env') : path.join(__dirname, '..', '.env.local')
const apply = args.includes('--apply')
const project = flag('--project')
const KEEP = new Set(['54321'])
const DOMAIN = 'mhs.smartassess'

dotenv.config({ path: path.resolve(envFile) })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) { console.error(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in ${envFile}`); process.exit(1) }
const ref = new URL(url).hostname.split('.')[0]
console.log(`Project: ${ref}   Mode: ${apply ? 'APPLY' : 'dry run (nothing is changed)'}`)
if (apply && project !== ref) { console.error(`Refusing to apply: add  --project ${ref}  to confirm this is the school you mean to change.`); process.exit(1) }

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function allStudents() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('profiles').select('id, full_name, student_id, grade_level, enrollments(class_groups(name))').eq('role', 'student').order('full_name').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

const students = await allStudents()
const isFive = (v) => /^\d{5}$/.test(String(v || ''))
const used = new Set(students.map((s) => String(s.student_id || '')).filter(Boolean))
const todo = students.filter((s) => !KEEP.has(String(s.student_id)) && !isFive(s.student_id))
console.log(`${students.length} students. ${students.length - todo.length} already have a 5-digit ID (or are the test student). ${todo.length} need a new ID.`)

function freshId() {
  for (let i = 0; i < 100000; i++) {
    const c = String(10000 + Math.floor(Math.random() * 90000))
    if (!used.has(c)) { used.add(c); return c }
  }
  throw new Error('No free 5-digit IDs left')
}
const plan = todo.map((s) => ({ id: s.id, name: s.full_name, grade: s.grade_level, cls: s.enrollments?.[0]?.class_groups?.name || '', oldId: s.student_id || '', newId: freshId() }))

const out = path.resolve(`student-id-changes-${ref}-${new Date().toISOString().slice(0, 10)}.csv`)
const csv = ['old_id,new_id,name,class,grade', ...plan.map((p) => [p.oldId, p.newId, `"${(p.name || '').replace(/"/g, '""')}"`, p.cls, p.grade ?? ''].join(','))].join('\n')
fs.writeFileSync(out, csv + '\n')
console.log(`Mapping written to ${out}  (keep it: it is the only record of old to new IDs)`)
plan.slice(0, 8).forEach((p) => console.log(`  ${p.oldId || '(none)'}  ->  ${p.newId}   ${p.name}`))
if (plan.length > 8) console.log(`  ... and ${plan.length - 8} more`)
if (!apply) { console.log('\nDry run only. Re-run with --apply --project ' + ref + ' to make the changes.'); process.exit(0) }

let ok = 0, failed = 0
for (const p of plan) {
  const { error: pe } = await supabase.from('profiles').update({ student_id: p.newId }).eq('id', p.id)
  if (pe) { console.error(`FAILED profile ${p.name}: ${pe.message}`); failed++; continue }
  const { error: ae } = await supabase.auth.admin.updateUserById(p.id, { email: `${p.newId}@${DOMAIN}`, email_confirm: true })
  if (ae) {
    await supabase.from('profiles').update({ student_id: p.oldId || null }).eq('id', p.id)
    console.error(`FAILED sign-in email ${p.name}: ${ae.message} (profile put back)`)
    failed++; continue
  }
  ok++
  if (ok % 25 === 0) console.log(`  ${ok} done`)
}
console.log(`Done. Changed ${ok}, failed ${failed}.`)
process.exit(failed ? 1 : 0)
