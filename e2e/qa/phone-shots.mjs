import { b, log, session, admin } from './lib.mjs'
const s = await session('student', '54321@mhs.smartassess', { width: 390, height: 844 })
for (const [name, p] of [['home', '/student'], ['lessons', '/learning'], ['week', '/learning/week'], ['timetable', '/student/timetable'], ['feedback', '/learning/feedback'], ['progress', '/learning/progress']]) {
  await s.page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded', timeout: 180000 }); await s.page.waitForTimeout(9000)
  for (let i = 0; i < 12; i++) { const k = s.page.getByRole('button', { name: /skip tour/i }); if (await k.count()) await k.first().click().catch(() => {}); else break }
  await s.page.screenshot({ path: `qa/out/phone-${name}.png`, fullPage: false }); log('shot', name)
}
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54321'); await b.close()
