// Clicks the sidebar items one after another and reports where each lands, which product the menu says it is in, and which item is lit.
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = path.resolve(import.meta.dirname, 'out')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const W = { teacher: ['teacher', 'testing.teacher@mhs.smartassess'], hod: ['supervisor', 'testing.hod@mhs.smartassess'], english: ['teacher', 'testing.english@mhs.smartassess'], principal: ['principal', 'testing.principal@mhs.smartassess'], admin: ['school_admin', 'testing.admin@mhs.smartassess'] }
const [who, startPath] = [process.argv[2] || 'english', process.argv[3] || '/learning']
const [sel, email] = W[who]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
await page.selectOption('select', sel); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await code.waitFor({ timeout: 60000 }); await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
const skip = async () => { for (let i = 0; i < 12; i++) { const s = page.getByRole('button', { name: /skip tour/i }); if (await s.count()) { await s.first().click().catch(() => {}); await page.waitForTimeout(300) } else break } }
await page.waitForTimeout(3500); await skip()
await page.goto(BASE + startPath, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(3500); await skip()
const state = () => page.evaluate(() => {
  const side = document.querySelector('.desktop-sidebar'); if (!side) return { sidebar: false }
  const links = [...side.querySelectorAll('nav a')].map((a) => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.getAttribute('href'), lit: getComputedStyle(a.firstElementChild).borderLeftColor === 'rgb(212, 118, 42)' }))
  const switcher = side.querySelector('button[aria-haspopup="menu"]')?.textContent.trim()
  return { sidebar: true, switcher, portal: [...side.querySelectorAll('div')].map((d) => d.textContent).find((t) => /Portal|Smart Learning$/.test(t) && t.length < 40), links }
})
await page.waitForSelector('.desktop-sidebar nav a', { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(1500); await skip()
let s = await state(); if (!s.links) { console.log('no sidebar yet at', page.url(), 'body:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)); process.exit(1) } console.log(`START ${startPath} -> ${new URL(page.url()).pathname}  switcher="${s.switcher}"  lit="${s.links?.filter((l) => l.lit).map((l) => l.text).join(' / ')}"`)
const items = s.links.map((l) => ({ text: l.text, href: l.href }))
for (const it of items) {
  await page.locator(`.desktop-sidebar nav a[href="${it.href}"]`).first().click().catch((e) => console.log('click failed', it.text))
  await page.waitForSelector('.desktop-sidebar nav a', { timeout: 120000 }).catch(() => {}); await page.waitForTimeout(3000); await skip()
  const after = await state(); const here = new URL(page.url()).pathname
  const note = here === it.href || here.startsWith(it.href + '/') ? '' : '   <-- ended somewhere else'
  console.log(`${it.text.padEnd(22)} ${it.href.padEnd(30)} landed ${here.padEnd(34)} switcher="${after.switcher}" lit="${after.links?.filter((l) => l.lit).map((l) => l.text).join(' / ')}"${note}`)
}
await b.close()
