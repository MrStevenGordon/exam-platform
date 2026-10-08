// Counts how many times each page asks the sign-in service "who is this?" (GET /auth/v1/user) while it loads.
import { b, log, session } from './lib.mjs'
const pages = { student: ['/student', '/student/tests', '/learning'], teacher: ['/teacher', '/learning'], supervisor: ['/supervisor'] }
const who = { student: '54328@mhs.smartassess', teacher: 'testing.teacher@mhs.smartassess', supervisor: 'testing.hod@mhs.smartassess' }
let total = 0
for (const [role, paths] of Object.entries(pages)) {
  const s = await session(role, who[role]); let n = 0, tok = 0
  s.page.on('request', (r) => { if (/\/auth\/v1\/user($|\?)/.test(r.url())) n++; if (/\/auth\/v1\/token/.test(r.url())) tok++ })
  for (const p of paths) { n = 0; await s.page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(9000); await s.skip(); log(`${role.padEnd(11)} ${p.padEnd(16)} who-is-this calls: ${n}`); total += n }
}
log('TOTAL', total); await b.close()
