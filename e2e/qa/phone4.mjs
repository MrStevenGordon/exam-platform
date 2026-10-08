import { b, log, session, admin } from './lib.mjs'
const ex = (await admin.from('draft_exams').select('id').eq('direct_published', true).limit(1)).data[0].id
await admin.from('draft_exams').update({ access_password: 'Ph0ne9' }).eq('id', ex)
try {
  const t = await session('teacher', 'testing.teacher@mhs.smartassess', { width: 390, height: 844 })
  await t.page.goto('http://localhost:3000/teacher/exam/' + ex, { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(8000); await t.skip()
  await t.page.screenshot({ path: 'out/phone4-hidden.png', clip: { x: 0, y: 150, width: 390, height: 260 } })
  await t.page.getByRole('button', { name: /reveal password/i }).click(); await t.page.waitForTimeout(2500)
  await t.page.screenshot({ path: 'out/phone4-shown.png', clip: { x: 0, y: 150, width: 390, height: 300 } })
  log('sideways:', await t.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2))
} finally { await admin.from('exam_access_passwords').delete().eq('exam_kind', 'draft').eq('exam_id', ex); await admin.from('exam_password_checks').delete().eq('exam_id', ex); await admin.from('exam_password_reveals').delete().eq('exam_id', ex); await b.close() }
