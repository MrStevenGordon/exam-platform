import { b, log, session, admin } from './lib.mjs'
const s = await session('student', '54328@mhs.smartassess')
await s.page.goto('http://localhost:3000/student/report-card', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(9000); await s.skip()
const t = await s.text(); log(t.slice(0, 900).replace(/\n/g, ' / '))
await s.page.screenshot({ path: 'out/report-card-term1.png', fullPage: true })
log('errors:', s.errs.join(' ; ') || 'none')
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328'); await b.close()
