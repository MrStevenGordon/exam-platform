import { b, log, session, admin } from './lib.mjs'
const h = await session('supervisor', 'testing.hod@mhs.smartassess')
await h.page.goto('http://localhost:3000/supervisor/final-exams', { waitUntil: 'domcontentloaded' }); await h.page.waitForTimeout(7000); await h.skip()
const tabs = h.page.getByRole('tab'); log('tabs found by role=tab:', await tabs.count(), '|', (await tabs.allInnerTexts()).join(' | '))
await h.page.getByRole('tab', { name: /Appointments/ }).click(); await h.page.waitForTimeout(2500)
log('after clicking Appointments, selected:', await h.page.getByRole('tab', { selected: true }).innerText(), '| url:', new URL(h.page.url()).search)
await h.page.keyboard.press('ArrowLeft'); await h.page.waitForTimeout(1500)
log('after ArrowLeft, selected:', await h.page.getByRole('tab', { selected: true }).innerText())
// B-012: a finished lesson no longer says Overdue
const s = await session('student', '54328@mhs.smartassess')
await s.page.goto('http://localhost:3000/learning', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(8000); await s.skip()
const t = await s.text(); log('student lessons page: "Overdue" present:', /Overdue by/.test(t), '| "Was due" present:', /Was due/.test(t), '|', (t.match(/.{0,50}(Overdue by|Was due).{0,30}/g) || []).join(' || '))
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328'); await b.close()
