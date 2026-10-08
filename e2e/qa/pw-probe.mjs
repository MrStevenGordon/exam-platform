import { b, log, session, admin } from './lib.mjs'
import { createClient } from '../../node_modules/@supabase/supabase-js/dist/index.mjs'
import fs from 'node:fs'
const PASSWORD = fs.readFileSync('../../scripts/dev-test-school.mjs', 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const { data: au, error } = await c.auth.signInWithPassword({ email: '54329@mhs.smartassess', password: PASSWORD }); if (error) throw error
const de = await c.from('draft_exams').select('title,access_password'); log('draft exams a student can read:', de.data.length, '| with a password visible:', de.data.filter((d) => d.access_password).length)
const fe = await c.from('final_exams').select('title,access_password'); log('final exams a student can read:', fe.data.length, '| with a password visible:', fe.data.filter((d) => d.access_password).length)
const tb = await c.from('exam_access_passwords').select('*'); log('student reads the passwords table:', tb.error ? `refused (${tb.error.code})` : `ALLOWED ${tb.data.length} rows`)
const fn = await c.rpc('exam_access_password', { p_kind: 'draft', p_exam: de.data[0].id }); log('student asks the staff function:', JSON.stringify(fn.data))
const withPw = (await admin.from('exam_access_passwords').select('exam_kind,exam_id,password')).data; log('passwords stored (staff-only table):', withPw.length)
for (const p of withPw.filter((x) => x.exam_kind === 'draft').slice(0, 3)) {
  const r = await c.from('exam_sessions').insert({ student_id: au.user.id, draft_exam_id: p.exam_id, status: 'in_progress', time_limit_seconds: 600 }).select('id')
  log('student starts a password-protected test without the password:', r.error ? `refused (${r.error.code}: ${r.error.message})` : 'ALLOWED'); if (r.data?.[0]) await admin.from('exam_sessions').delete().eq('id', r.data[0].id)
}
const h = await session('supervisor', 'testing.hod@mhs.smartassess')
const finals = (await admin.from('final_exams').select('id,title').limit(1)).data
for (const f of finals) { await h.page.goto('http://localhost:3000/supervisor/final-exams/' + f.id + '/sessions', { waitUntil: 'domcontentloaded' }); await h.page.waitForTimeout(8000); await h.skip(); log('HOD sessions page for', f.title, '->', (await h.text()).match(/Access password for students:\s*\S+/)?.[0] ?? 'NO PASSWORD SHOWN') }
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54329')
await b.close()
