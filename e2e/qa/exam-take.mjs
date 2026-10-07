// End to end on the TEST school: publish the QA Trial Test to class 3-1, a student takes it, the teacher releases the results, the student sees them.
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
import { createClient } from '../../node_modules/@supabase/supabase-js/dist/index.mjs'
import dotenv from '../../node_modules/dotenv/lib/main.js'
const ROOT = path.resolve(import.meta.dirname, '../..'); dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true })
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const OUT = path.resolve(import.meta.dirname, 'out'); const EXAM = process.argv[2]; const STUDENT = process.argv[3] || '54326'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const log = (...a) => console.log(...a)
async function session(sel, email, viewport = { width: 1280, height: 900 }) {
  const ctx = await b.newContext({ viewport }); const page = await ctx.newPage(); page.on('dialog', (d) => { log('   [dialog]', d.message().slice(0, 120)); d.accept() })
  const errs = []; page.on('response', (r) => { if (r.status() >= 400 && !/_next|favicon|rpc\/cancel_teacher/.test(r.url())) errs.push(`${r.status()} ${r.request().method()} ${r.url().replace(/\?.*/, '').slice(0, 110)}`) }); page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 120)))
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
  if (sel === 'student') await admin.from('profiles').update({ active_login_token: null }).eq('student_id', email.split('@')[0])
  if (sel !== 'student') await page.selectOption('select', sel); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
  const code = page.locator('input[placeholder="123456"]'); await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }), code.waitFor({ timeout: 60000 })])
  if (await code.count()) { await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]'); await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }) }
  const skip = async () => { for (let i = 0; i < 12; i++) { const s = page.getByRole('button', { name: /skip tour/i }); if (await s.count()) await s.first().click().catch(() => {}); else break } }
  return { page, ctx, errs, skip, text: async () => (await page.locator('main, body').first().innerText()).replace(/\n{2,}/g, '\n') }
}
// 1. teacher publishes
log('signing in the teacher...')
let t = await session('teacher', 'testing.teacher@mhs.smartassess'); log('signed in')
await t.page.goto('http://localhost:3000/teacher/exam/' + EXAM, { waitUntil: 'domcontentloaded' }); await t.page.waitForTimeout(7000); await t.skip()
log('opening the exam page'); await t.page.getByText('3-1', { exact: true }).last().click({ timeout: 30000 }); await t.page.waitForTimeout(800); log('class ticked')
await t.page.getByRole('button', { name: /Publish to 1 class/i }).click(); await t.page.waitForTimeout(6000)
log('1. teacher after publish ->', new URL(t.page.url()).pathname, '|', (await t.text()).slice(0, 260).replace(/\n/g, ' / ')); log('   errors:', t.errs.join(' ; ') || 'none'); await t.ctx.close()
