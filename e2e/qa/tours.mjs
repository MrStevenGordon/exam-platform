// Signs in at the NETWORK address (like another laptop would), and looks for the first-visit tutorial in Smart Assess and Smart Learning.
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = process.env.BASE_URL || 'http://10.102.54.236:3000'
const OUT = path.resolve(import.meta.dirname, 'out')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const W = { teacher: ['teacher', 'testing.teacher@mhs.smartassess', '/teacher'], hod: ['supervisor', 'testing.hod@mhs.smartassess', '/supervisor'], principal: ['principal', 'testing.principal@mhs.smartassess', '/principal'], admin: ['school_admin', 'testing.admin@mhs.smartassess', '/school-admin'], student: ['student', '54322@mhs.smartassess', '/student'] }
const who = process.argv[2] || 'student'; const [sel, email, home] = W[who]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
const problems = []; page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(m.text().slice(0, 200)) })
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500)
await page.selectOption('select', sel); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); try { await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45000 }), code.waitFor({ timeout: 45000 })]) } catch { console.log('sign-in did not finish. The page says:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(-260)); await b.close(); process.exit(1) }
if (await code.count()) { await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]'); await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }) }
const tourText = async () => (await page.locator('div[style*="z-index: 1000"]').first().innerText({ timeout: 1500 }).catch(() => '')).replace(/\s+/g, ' ')
await page.waitForTimeout(4000)
console.log(`${who}: signed in at ${new URL(page.url()).host}, now at ${new URL(page.url()).pathname}`)
const t1 = await tourText(); console.log('Smart Assess tutorial:', t1 ? 'SHOWN  -> ' + t1.slice(0, 150) : 'not shown')
await page.screenshot({ path: path.join(OUT, `tour-assess-${who}.png`) })
// click through to the end so it is marked seen, then open Smart Learning
for (let i = 0; i < 12 && (await tourText()); i++) { const btn = page.getByRole('button', { name: /next|done|got it|finish/i }).first(); if (!(await btn.count())) break; await btn.click(); await page.waitForTimeout(400) }
await page.goto(BASE + '/learning', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(4500)
const t2 = await tourText(); console.log('Smart Learning tutorial:', t2 ? 'SHOWN  -> ' + t2.slice(0, 170) : 'not shown')
await page.screenshot({ path: path.join(OUT, `tour-learning-${who}.png`) })
let steps = 0; for (let i = 0; i < 12 && (await tourText()); i++) { steps++; const btn = page.getByRole('button', { name: /next|done|got it|finish/i }).first(); if (!(await btn.count())) break; await btn.click(); await page.waitForTimeout(400) }
console.log('Smart Learning tutorial steps clicked through:', steps, '| console errors:', problems.length ? problems.join(' | ') : 'none')
await b.close()
