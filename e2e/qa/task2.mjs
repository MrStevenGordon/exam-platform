import { b, log, session, admin } from './lib.mjs'
let ok = true; const check = (n, p, x = '') => { if (!p) ok = false; log(p ? 'PASS' : 'FAIL', n, x) }
for (const old of (await admin.from('draft_exams').select('id').eq('title', 'QA Homework Check')).data || []) { const ids = (await admin.from('exam_sessions').select('id').eq('draft_exam_id', old.id)).data.map((x) => x.id); if (ids.length) { await admin.from('responses').delete().in('session_id', ids); await admin.from('exam_sessions').delete().in('id', ids) } await admin.from('draft_exam_class_groups').delete().eq('draft_exam_id', old.id); await admin.from('questions').delete().eq('draft_exam_id', old.id); await admin.from('draft_exams').delete().eq('id', old.id) }
let exId
try {
  const t = await session('teacher', 'testing.teacher@mhs.smartassess')
  await t.page.goto('http://localhost:3000/teacher/tasks', { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000); await t.skip()
  await t.page.getByText('+ New Task').first().click(); await t.page.waitForTimeout(5000); log('   form url:', t.page.url().replace('http://localhost:3000', '')); const formText0 = await t.text()
  const sels = t.page.locator('main select'); await sels.nth(0).selectOption({ label: 'Homework' }).catch(async () => { await sels.nth(0).selectOption('homework') })
  const texts = t.page.locator('main input:not([type=checkbox])'); await texts.nth(0).fill('QA Homework Check'); await texts.nth(1).fill('Mathematics')
  await t.page.locator('main textarea').fill('Answer both questions.')
  await sels.nth(1).selectOption({ label: 'Grade 9' }).catch(async () => { await sels.nth(1).selectOption({ index: 3 }) })
  await t.page.getByRole('button', { name: /Create task/i }).click(); await t.page.waitForURL((u) => /\/teacher\/exam\//.test(u.pathname), { timeout: 60000 }).catch(() => {})
  exId = (new URL(t.page.url()).pathname.match(/exam\/([0-9a-f-]{36})/) || [])[1]
  check('task created from the form', !!exId, new URL(t.page.url()).pathname)
  check('form says task, not exam', /New task/i.test(formText0) && /Task type/i.test(formText0) && /which grade is this task for/i.test(formText0) && /during this task/i.test(formText0) && !/this exam/i.test(formText0), formText0.slice(0, 40).replace(/\n/g, ' '))
  const row = (await admin.from('draft_exams').select('exam_kind,duration_minutes,title,target_grade').eq('id', exId).single()).data; log('   row:', JSON.stringify(row))
  const T = (await admin.from('profiles').select('id').eq('full_name', 'Testing Teacher').single()).data.id
  await admin.from('questions').insert([{ draft_exam_id: exId, created_by: T, question_type: 'multiple_choice', question_text: 'HW q1: 2 + 2?', options: ['3', '4', '5', '6'], correct_answer: '4', points: 1, order_index: 1 }, { draft_exam_id: exId, created_by: T, question_type: 'short_answer', question_text: 'HW q2: 3 x 3?', correct_answer: '9', points: 1, order_index: 2 }])
  await t.page.reload({ waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000)
  await t.page.getByText('3-1', { exact: true }).last().click(); await t.page.waitForTimeout(1200)
  await t.page.getByRole('button', { name: /Publish to 1 class/ }).click(); await t.page.waitForTimeout(7000)
  check('teacher can publish it', /reveal password/i.test(await t.text()))
  await t.page.getByRole('button', { name: 'Reveal password' }).click(); await t.page.waitForTimeout(2500)
  const PW = (await t.page.locator('span[style*="monospace"]').allInnerTexts()).find((x) => /^[A-Za-z0-9]{6}$/.test(x.trim()))?.trim(); check('password revealed', !!PW, PW)
  const s = await session('student', '54328@mhs.smartassess')
  await s.page.goto('http://localhost:3000/student/direct-exam/' + exId, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(7000); await s.skip()
  const pre = await s.text(); check('student sees the homework banner (no timer/proctoring)', /Take your time|homework/i.test(pre))
  await s.page.locator('input').first().fill(PW); await s.page.getByRole('button', { name: 'Unlock' }).click(); await s.page.waitForTimeout(3000)
  await s.page.getByRole('button', { name: /Begin/ }).first().click(); await s.page.waitForURL((u) => /\/take/.test(u.pathname), { timeout: 90000 }).catch(() => {}); await s.page.waitForTimeout(5000)
  check('student reaches the questions', /HW q1/.test(await s.text()), new URL(s.page.url()).pathname + ' ' + s.errs.slice(0, 2).join(';'))
  await s.page.getByText('4', { exact: true }).first().click().catch(() => {}); const sa = s.page.locator('input[type=text], textarea').first(); if (await sa.count()) await sa.fill('9')
  await s.page.waitForTimeout(1500)
  const btns = await s.page.locator('button').allInnerTexts(); log('   buttons:', btns.map((x) => x.trim()).filter(Boolean).join(' | ')); check('the hand-in button says task, not exam', btns.some((x) => /submit task/i.test(x)))
  await s.page.getByRole('button', { name: /submit|finish|hand in/i }).first().click().catch((e) => log('   no submit button', e.message.slice(0, 60))); await s.page.waitForTimeout(3000)
  await s.page.getByRole('button', { name: /confirm|yes|submit/i }).last().click({ timeout: 4000 }).catch(() => {}); await s.page.waitForTimeout(8000)
  const done = await s.text(); check('submitted page says Task submitted and links back to tasks', /Task submitted/i.test(done) && /Back to my tasks/i.test(done)); log('   after submit:', new URL(s.page.url()).pathname, done.slice(0, 200).replace(/\n/g, ' / '))
  const sess = (await admin.from('exam_sessions').select('status,total_score,max_possible_score,results_released').eq('draft_exam_id', exId)).data; check('sitting recorded as completed', sess[0]?.status === 'completed', JSON.stringify(sess[0]))
  log(ok ? 'ALL PASS' : 'SOME FAILED')
} finally {
  if (exId) { const ids = (await admin.from('exam_sessions').select('id').eq('draft_exam_id', exId)).data.map((x) => x.id); if (ids.length) { await admin.from('responses').delete().in('session_id', ids); await admin.from('exam_sessions').delete().in('id', ids) } await admin.from('draft_exam_class_groups').delete().eq('draft_exam_id', exId); await admin.from('questions').delete().eq('draft_exam_id', exId); await admin.from('draft_exams').delete().eq('id', exId) }
  await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328'); await b.close()
}
