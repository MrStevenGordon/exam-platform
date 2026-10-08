import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const email = 'qa.owner@mhs.smartassess'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); page.on('dialog', (d) => d.accept())
const errs = []; page.on('response', (r) => { if (r.status() >= 400 && !/_next|favicon/.test(r.url())) errs.push(`${r.status()} ${r.request().method()} ${r.url().replace(/\?.*/, '').slice(0, 100)}`) }); page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 100)))
await page.goto('http://localhost:3000/admin-login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
await page.fill('input[type=email], input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"], input[inputmode=numeric]'); await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/admin-login'), { timeout: 60000 }), code.first().waitFor({ timeout: 60000 })]).catch(() => {})
if (await code.count()) { await code.first().fill(totp(SECRETS[email])); await page.click('button[type=submit]'); await page.waitForURL((u) => !u.pathname.startsWith('/admin-login'), { timeout: 60000 }).catch(() => {}) }
await page.waitForTimeout(5000)
const skip = async () => { for (let i = 0; i < 12; i++) { const s = page.getByRole('button', { name: /skip tour/i }); if (await s.count()) await s.first().click().catch(() => {}); else break } }
console.log('signed in ->', new URL(page.url()).pathname); await skip()
for (const p of ['/owner/school-requests', '/owner/org-requests', '/owner/school-features', '/owner/library', '/owner/curriculum', '/owner/school-subscriptions', '/owner/organization-payments']) {
  errs.length = 0
  await page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(7000); await skip()
  const t = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 330)
  const sw = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  console.log(`\n${p}${sw ? '  [SIDEWAYS SCROLL]' : ''}\n  ${t}\n  errors: ${errs.join(' ; ') || 'none'}`)
}
await b.close()
