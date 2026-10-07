// Lists the fields and buttons of a page as a role. Usage: node qa/forms.mjs teacher /teacher/new?kind=test
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const W = { teacher: ['teacher', 'testing.teacher@mhs.smartassess'], hod: ['supervisor', 'testing.hod@mhs.smartassess'], english: ['teacher', 'testing.english@mhs.smartassess'], admin: ['school_admin', 'testing.admin@mhs.smartassess'], principal: ['principal', 'testing.principal@mhs.smartassess'] }
const [who, p] = process.argv.slice(2); const [sel, email] = W[who]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
await page.selectOption('select', sel); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await code.waitFor({ timeout: 60000 }); await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
await page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(6000)
for (let i = 0; i < 12; i++) { const s = page.getByRole('button', { name: /skip tour/i }); if (await s.count()) await s.first().click().catch(() => {}); else break }
const info = await page.evaluate(() => {
  const lab = (el) => (el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || '').trim().replace(/\s+/g, ' ')
  return { url: location.pathname + location.search,
    fields: [...document.querySelectorAll('main input, main select, main textarea')].map((e) => `${e.tagName.toLowerCase()}${e.type ? '[' + e.type + ']' : ''} "${lab(e)}"${e.tagName === 'SELECT' ? ' options=' + [...e.options].slice(0, 8).map((o) => o.text).join('|') : ''}`),
    buttons: [...document.querySelectorAll('main button, main a.btn')].map((e) => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40) } })
console.log(info.url); console.log('FIELDS:\n ' + info.fields.join('\n ')); console.log('BUTTONS: ' + info.buttons.join(' | ')); await b.close()
