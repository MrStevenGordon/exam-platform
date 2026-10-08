// Checks that "Reset all passwords" asks before doing anything, and DISMISSES the question (nothing is reset).
import { b, log, session } from './lib.mjs'
const a = await session('school_admin', 'testing.admin@mhs.smartassess')
a.page.removeAllListeners('dialog'); let asked = []
a.page.on('dialog', (d) => { asked.push(d.type() + ': ' + d.message().slice(0, 200)); d.dismiss() })
a.page.on('request', (r) => { if (/reset|password/i.test(r.url()) && r.method() !== 'GET' && !/_next/.test(r.url())) log('   REQUEST SENT:', r.method(), r.url().slice(0, 120)) })
await a.page.goto('http://localhost:3000/school-admin/staff', { waitUntil: 'domcontentloaded', timeout: 180000 }); await a.page.waitForSelector('text=Reset all passwords', { timeout: 120000 }); await a.page.waitForTimeout(3000); await a.skip()
await a.page.getByRole('button', { name: /Reset all passwords/i }).click(); await a.page.waitForTimeout(4000)
log('dialogs shown:', asked.join(' || ') || '(none)'); log('page after:', (await a.text()).slice(0, 260).replace(/\n/g, ' / ')); await b.close()
