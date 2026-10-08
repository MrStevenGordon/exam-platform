import { b, log, session, admin } from './lib.mjs'
const f = (await admin.from('final_exams').select('id,title').limit(1)).data[0]
await admin.from('final_exams').update({ access_password: 'Z9Y8X7' }).eq('id', f.id)
try {
  const h = await session('supervisor', 'testing.hod@mhs.smartassess')
  await h.page.goto('http://localhost:3000/supervisor/final-exams/' + f.id + '/sessions', { waitUntil: 'domcontentloaded' }); await h.page.waitForTimeout(8000); await h.skip()
  log('HOD sessions page ->', (await h.text()).match(/Access password for students:\s*\S+/)?.[0] ?? 'NO PASSWORD SHOWN')
  const t = await session('teacher', 'testing.science@mhs.smartassess')
  await t.page.goto('http://localhost:3000/supervisor/final-exams/' + f.id + '/sessions', { waitUntil: 'domcontentloaded' }).catch(() => {}); await t.page.waitForTimeout(5000)
  log('unrelated teacher on that page ->', (await t.text()).match(/Access password for students:\s*\S+/)?.[0] ?? 'no password shown (good)')
} finally {
  await admin.from('exam_access_passwords').delete().eq('exam_kind', 'final').eq('exam_id', f.id); await admin.from('exam_password_checks').delete().eq('exam_id', f.id)
  log('left over for the final exam:', (await admin.from('exam_access_passwords').select('exam_id').eq('exam_id', f.id)).data.length, 'password rows; column value:', JSON.stringify((await admin.from('final_exams').select('access_password').eq('id', f.id).single()).data))
  await b.close()
}
