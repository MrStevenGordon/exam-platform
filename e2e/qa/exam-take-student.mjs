import { b, log, session, admin } from './lib.mjs'
const [STUDENT, EXAM, PW] = process.argv.slice(2)
const s = await session('student', `${STUDENT}@mhs.smartassess`)
await s.page.goto(`http://localhost:3000/student/direct-exam/${EXAM}/take`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await s.page.waitForTimeout(12000); await s.skip()
const dump = async (label) => { const t = await s.text(); const btn = await s.page.evaluate(() => [...document.querySelectorAll('button, main a, label')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 24)); log(`${label} -> ${new URL(s.page.url()).pathname}\n   ${t.slice(0, 600).replace(/\n/g, ' / ')}\n   controls: ${btn.join(' | ')}`) }
await dump('take page'); await s.page.screenshot({ path: 'qa/out/student-take.png', fullPage: true }); log('errors:', s.errs.join(' ; ') || 'none')
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', STUDENT); await b.close()
