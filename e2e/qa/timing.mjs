// Lists every database request a page makes, with how long each took (test school). Usage: node qa/timing.mjs hod /supervisor/analytics
import { chromium } from 'playwright-core'
import fs from 'node:fs'; import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const WHO = { teacher: ['teacher', 'testing.teacher@mhs.smartassess'], hod: ['supervisor', 'testing.hod@mhs.smartassess'], principal: ['principal', 'testing.principal@mhs.smartassess'], admin: ['school_admin', 'testing.admin@mhs.smartassess'] }[process.argv[2]]
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2000)
await page.selectOption('select', WHO[0]); await page.fill('input[type=text]', WHO[1]); await page.fill('input[type=password]', PASSWORD); await page.click('button[type=submit]')
const code = page.locator('input[placeholder="123456"]'); await code.waitFor({ timeout: 60000 }); await code.fill(totp(SECRETS[WHO[1]])); await page.click('button[type=submit]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
const reqs = []; const t0 = Date.now()
page.on('requestfinished', async (r) => { if (!r.url().includes('supabase.co')) return; const rs = await r.response(); reqs.push({ at: Date.now() - t0, ms: Math.round(r.timing().responseEnd), status: rs?.status(), url: r.url().replace(/^https:\/\/[^/]+\/rest\/v1\//, '').slice(0, 130) }) })
await page.goto('http://localhost:3000' + process.argv[3], { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {}); await page.waitForTimeout(3000)
reqs.sort((a, c) => c.ms - a.ms); console.log(`${reqs.length} database requests; slowest:`); for (const r of reqs.slice(0, 12)) console.log(String(r.ms).padStart(6) + 'ms', r.status, r.url)
await b.close()
