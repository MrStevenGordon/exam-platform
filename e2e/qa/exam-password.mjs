// B-020 check: the exam password is generated on Publish, shown only to the teacher, checked on the server for the student.
import { b, log, session, admin } from './lib.mjs'
for (const old of (await admin.from('draft_exams').select('id').eq('title', 'PW97 E2E class test')).data || []) {
  const ids = (await admin.from('exam_sessions').select('id').eq('draft_exam_id', old.id)).data.map((x) => x.id)
  if (ids.length) { await admin.from('responses').delete().in('session_id', ids); await admin.from('exam_sessions').delete().in('id', ids) }
  await admin.from('draft_exam_class_groups').delete().eq('draft_exam_id', old.id); await admin.from('questions').delete().eq('draft_exam_id', old.id); await admin.from('draft_exams').delete().eq('id', old.id)
}
const T = (await admin.from('profiles').select('id').eq('full_name', 'Testing Teacher').single()).data.id
const cls = (await admin.from('class_groups').select('id').eq('name', '3-1').eq('year_grade', 'Grade 9').single()).data.id
const ex = (await admin.from('draft_exams').insert({ title: 'PW97 E2E class test', subject: 'Mathematics', created_by: T, status: 'draft', exam_kind: 'class_test', duration_minutes: 20, target_grade: 9 }).select('id').single()).data.id
await admin.from('questions').insert([1, 2].map((i) => ({ draft_exam_id: ex, created_by: T, question_type: 'multiple_choice', question_text: `PW97 question ${i}`, options: ['a', 'b', 'c', 'd'], correct_answer: 'a', points: 1, order_index: i })))
let ok = true; const check = (name, pass, extra = '') => { if (!pass) ok = false; log(pass ? 'PASS' : 'FAIL', name, extra) }
try {
  const t = await session('teacher', 'testing.teacher@mhs.smartassess')
  await t.page.goto('http://localhost:3000/teacher/exam/' + ex, { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000); await t.skip()
  await t.page.getByText('3-1', { exact: true }).last().click(); await t.page.waitForTimeout(1200)
  await t.page.getByRole('button', { name: /Publish to 1 class/ }).click(); await t.page.waitForTimeout(7000)
  const body = await t.text(); const m = body.match(/Exam password:\s*([A-Za-z0-9]{4,8})/)
  const PW = m?.[1]
  check('teacher sees the password after Publish', !!PW, PW ? `(${PW})` : body.slice(0, 200).replace(/\n/g, ' / '))
  const stored = (await admin.from('exam_access_passwords').select('password').eq('exam_kind', 'draft').eq('exam_id', ex).maybeSingle()).data?.password
  check('it is stored in the staff-only table and the exam row is empty', stored === PW && (await admin.from('draft_exams').select('access_password').eq('id', ex).single()).data.access_password === null)
  await t.page.reload({ waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(6000)
  check('teacher still sees it after a reload', /Exam password:\s*\S+/.test(await t.text()))
  // student
  const s = await session('student', '54328@mhs.smartassess')
  const apiRow = await s.page.evaluate(async (id) => { const r = await fetch('/'); return null }, ex).catch(() => null)
  await s.page.goto('http://localhost:3000/student/direct-exam/' + ex, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(7000); await s.skip()
  check('student sees the password box', await s.page.getByRole('button', { name: 'Unlock' }).count() > 0)
  await s.page.locator('input').first().fill('WRONG1'); await s.page.getByRole('button', { name: 'Unlock' }).click(); await s.page.waitForTimeout(3000)
  check('a wrong password is refused', /Incorrect password/.test(await s.text()))
  check('and Begin is not offered', (await s.page.getByRole('button', { name: /Begin/ }).count()) === 0)
  await s.page.locator('input').first().fill(PW.toLowerCase()); await s.page.getByRole('button', { name: 'Unlock' }).click(); await s.page.waitForTimeout(3000)
  check('the right password (lower case typed) unlocks', (await s.page.getByRole('button', { name: /Begin/ }).count()) > 0)
  await s.page.getByRole('button', { name: /Begin/ }).first().click(); await s.page.waitForURL((u) => /\/take/.test(u.pathname), { timeout: 90000 }).catch(() => {}); await s.page.waitForTimeout(5000)
  check('the student reaches the questions', /\/take/.test(s.page.url()) && /PW97 question/.test(await s.text()), new URL(s.page.url()).pathname)
  log('page errors:', s.errs.filter((e) => !/401|404/.test(e)).join(' ; ') || 'none')
  log(ok ? 'ALL PASS' : 'SOME FAILED')
} finally {
  const ids = (await admin.from('exam_sessions').select('id').eq('draft_exam_id', ex)).data.map((x) => x.id)
  if (ids.length) { await admin.from('responses').delete().in('session_id', ids); await admin.from('exam_sessions').delete().in('id', ids) }
  await admin.from('draft_exam_class_groups').delete().eq('draft_exam_id', ex); await admin.from('questions').delete().eq('draft_exam_id', ex); await admin.from('draft_exams').delete().eq('id', ex)
  await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328')
  await b.close()
}
