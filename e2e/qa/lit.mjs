// Opens given pages as a role and reports which menu item is lit and which product the menu says. Usage: node qa/lit.mjs teacher /teacher/exam/<id> /teacher/report-absence
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const W = { teacher: ['teacher', 'testing.teacher@mhs.smartassess'], hod: ['supervisor', 'testing.hod@mhs.smartassess'], english: ['teacher', 'testing.english@mhs.smartassess'] }
const [who, ...paths] = process.argv.slice(2); const [sel, email] = W[who]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
await page.selectOption('select', sel); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await code.waitFor({ timeout: 60000 }); await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
for (const p of paths) {
  await page.goto('http://localhost:3000' + p, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.desktop-sidebar nav a', { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(3500)
  for (let i = 0; i < 12; i++) { const s = page.getByRole('button', { name: /skip tour/i }); if (await s.count()) await s.first().click().catch(() => {}); else break }
  const r = await page.evaluate(() => { const side = document.querySelector('.desktop-sidebar'); if (!side) return null; return { switcher: side.querySelector('button[aria-haspopup="menu"]')?.textContent.trim(), lit: [...side.querySelectorAll('nav a')].filter((a) => getComputedStyle(a.firstElementChild).borderLeftColor === 'rgb(212, 118, 42)').map((a) => a.textContent.trim().replace(/\s+/g, ' ')) } })
  console.log(`${p.padEnd(58)} -> ${new URL(page.url()).pathname.padEnd(40)} ${r ? `menu: ${r.switcher}, lit: ${r.lit.join(' / ') || '(none)'}` : 'no menu'}`)
}
await b.close()
