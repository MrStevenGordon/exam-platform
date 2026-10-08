import { b, log, session, admin } from './lib.mjs'
const t = await session('teacher', 'testing.teacher@mhs.smartassess')
for (const p of ['/teacher/tasks', '/teacher/play-preview']) { await t.page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000); await t.skip(); log('TEACHER', p, '\n ', (await t.text()).slice(0, 700).replace(/\n/g, ' / '), '\n  buttons:', (await t.page.locator('main button, main a').allInnerTexts()).map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 14).join(' | ')) }
const s = await session('student', '54328@mhs.smartassess')
for (const p of ['/student/tasks', '/student/self-mock', '/student/play-preview']) { await s.page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(7000); await s.skip(); log('STUDENT', p, '\n ', (await s.text()).slice(0, 700).replace(/\n/g, ' / '), '\n  buttons:', (await s.page.locator('main button, main a').allInnerTexts()).map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 14).join(' | ')) }
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328'); await b.close()
