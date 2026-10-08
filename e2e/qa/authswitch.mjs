import { b, log, session, admin } from './lib.mjs'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const s = await session('student', '54328@mhs.smartassess')
await s.page.goto('http://localhost:3000/student', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(6000); await s.skip()
const nameOf = async () => s.page.evaluate(async () => { const m = await import('/_next/static/chunks/x').catch(() => null); return null })
const who = async () => (await s.text()).slice(0, 300).replace(/\n/g, ' / ')
log('1. student home:', (await who()).slice(0, 160))
// sign out through the menu
const out = s.page.getByRole('button', { name: /log ?out|sign ?out/i }).first()
log('   sign-out control found:', await out.count())
await out.click().catch(async () => { await s.page.getByText(/log ?out|sign ?out/i).first().click() })
await s.page.waitForURL(/\/login/, { timeout: 30000 }).catch(() => {}); await s.page.waitForTimeout(2500)
log('2. after sign out ->', new URL(s.page.url()).pathname)
// now sign in as the teacher in the SAME browser context
const email = 'testing.teacher@mhs.smartassess'
await s.page.selectOption('select', 'teacher'); await s.page.fill('input[type=text]', email); await s.page.fill('input[type=password]', PASSWORD); await s.page.click('button[type=submit]')
const code = s.page.locator('input[placeholder="123456"]'); await Promise.race([s.page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }), code.waitFor({ timeout: 60000 })]).catch(() => {})
if (await code.count()) { await code.fill(totp(SECRETS[email])); await s.page.click('button[type=submit]'); await s.page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }) }
await s.page.waitForTimeout(6000); await s.skip()
log('3. teacher signed in, url ->', new URL(s.page.url()).pathname)
const me = await s.page.evaluate(async () => { const r = await fetch('/api/whoami').catch(() => null); return r ? r.status : 'no route' })
const t = await s.text(); log('   page mentions:', /Testing Teacher/.test(t) ? 'Testing Teacher (correct)' : 'NOT the teacher name', '| student name present:', /Student Number|54328/.test(t) ? 'YES (bad)' : 'no (good)')
await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54328')
await b.close()
