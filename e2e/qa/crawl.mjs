// QA crawl for the TEST school (local dev server + test project). Signs in as each test role (staff codes come from .qa-totp.json), opens every page in
// that role's portal on desktop and phone sizes, and records console errors, failed requests, error screens, empty pages and sideways scrolling.
// Usage: node qa/crawl.mjs [role,role] [desktop|mobile]     (BASE_URL defaults to http://localhost:3000; password from scripts/dev-test-school.mjs)
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
import { createClient } from '../../node_modules/@supabase/supabase-js/dist/index.mjs'
import dotenv from '../../node_modules/dotenv/lib/main.js'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const ROOT = path.resolve(import.meta.dirname, '../..')
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
dotenv.config({ path: path.join(path.resolve(import.meta.dirname, '../..'), '.env.local'), quiet: true })
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
// a student can be signed in on one device only; the test student's lock is released before each sign-in so earlier runs never block a new one
const releaseStudent = () => admin.from('profiles').update({ active_login_token: null, active_login_started_at: null, active_login_last_seen_at: null }).eq('student_id', '54321')
const OUT = path.resolve(import.meta.dirname, 'out'); fs.mkdirSync(OUT, { recursive: true })

const LEARN = ['/learning', '/learning/week', '/learning/feedback', '/learning/videos', '/learning/library']
const ROLES = {
  student: { select: 'student', login: '54321@mhs.smartassess', pages: ['/student', '/student/exams', '/student/tests', '/student/tasks', '/student/history', '/student/timetable', '/student/topics', '/student/report-card', '/student/self-mock', '/student/profile', '/student/play-preview', '/learning/progress', '/learning/flashcards', ...LEARN] },
  teacher: { select: 'teacher', login: 'testing.teacher@mhs.smartassess', pages: ['/teacher', '/teacher/classes', '/teacher/new', '/teacher/tests', '/teacher/tasks', '/teacher/grade', '/teacher/bank', '/teacher/folder', '/teacher/attendance', '/teacher/timetable', '/teacher/insight', '/teacher/lesson-plans', '/teacher/messages', '/teacher/profile', '/teacher/report-cards', '/teacher/report-absence', '/teacher/cover', '/teacher/vetting', '/teacher/team-lead', '/teacher/play-preview', '/learning/lessons/new', '/learning/lesson-plans', '/learning/support', '/learning/resources', '/learning/library/assignments', ...LEARN] },
  supervisor: { select: 'supervisor', login: 'testing.hod@mhs.smartassess', pages: ['/supervisor', '/supervisor/analytics', '/supervisor/appointments', '/supervisor/attendance', '/supervisor/class-assignments', '/supervisor/classes', '/supervisor/classrooms', '/supervisor/exams', '/supervisor/exams/new', '/supervisor/final-exams', '/supervisor/integrity', '/supervisor/messages', '/supervisor/profile', '/supervisor/report-cards', '/supervisor/students', '/supervisor/subjects', '/supervisor/submissions', '/supervisor/substitution', '/supervisor/teachers', '/supervisor/timetable', '/supervisor/topics', '/learning/coverage', '/learning/support', '/learning/resources', ...LEARN] },
  principal: { select: 'principal', login: 'testing.principal@mhs.smartassess', pages: ['/principal', '/principal/ai-tutor', '/principal/alerts', '/principal/attendance', '/principal/insight', '/principal/messages', '/principal/profile', '/principal/school-day', '/principal/staff', '/principal/students', '/principal/timetable', '/learning/flags', '/learning/support', ...LEARN] },
  school_admin: { select: 'school_admin', login: 'testing.admin@mhs.smartassess', pages: ['/school-admin', '/school-admin/active-sessions', '/school-admin/activity', '/school-admin/analytics', '/school-admin/departments', '/school-admin/insight', '/school-admin/integrity', '/school-admin/library', '/school-admin/messages', '/school-admin/password-requests', '/school-admin/profile', '/school-admin/report-cards', '/school-admin/school-day', '/school-admin/settings', '/school-admin/staff', '/school-admin/students', '/school-admin/subjects', '/school-admin/substitution', '/school-admin/timetable', '/school-admin/topics', '/learning/coverage', '/learning/flags', '/learning/support', '/learning/resources', ...LEARN] },
}
const want = (process.argv[2] || 'student,teacher,supervisor,principal,school_admin').split(',')
const modes = (process.argv[3] || 'desktop').split(',')
const VIEW = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } }
const NOISE = /rpc\/cancel_teacher_absence|favicon|Download the React DevTools|\[Fast Refresh\]|HMR|webpack-hmr|_next\/static|sentry|\/monitoring|chat-widget|Failed to load resource: net::ERR_ABORTED/i
const BAD_TEXT = /Application error|Unhandled Runtime Error|This page could not be found|Something went wrong|Internal Server Error|Cannot read properties|is not a function/i

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const findings = []; const visited = []

for (const roleKey of want) {
  const R = ROLES[roleKey]; if (!R) continue
  for (const mode of modes) {
    const ctx = await browser.newContext({ viewport: VIEW[mode], isMobile: mode === 'mobile', hasTouch: mode === 'mobile' })
    const page = await ctx.newPage()
    let bucket = []
    page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) bucket.push('console: ' + m.text().slice(0, 300)) })
    page.on('pageerror', (e) => bucket.push('pageerror: ' + String(e.message).slice(0, 300)))
    page.on('response', async (r) => { const s = r.status(); const u = r.url(); if (s >= 400 && !NOISE.test(u) && !/\/(favicon|_next\/image)/.test(u)) { const body = s >= 500 || process.env.BODIES ? (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220) : ''; bucket.push(`http ${s}: ${r.request().method()} ${u.slice(0, process.env.BODIES ? 300 : 160).replace(/\?.*$/, (m) => (process.env.BODIES ? m : ''))}${body ? '  => ' + body : ''}`) } })
    page.on('requestfailed', (r) => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(f) && !NOISE.test(r.url())) bucket.push(`request failed: ${r.url().slice(0, 140)} ${f}`) })

    // sign in
    if (roleKey === 'student') await releaseStudent()
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)                       // let the page finish loading before choosing the role (it resets the choice otherwise)
    await page.selectOption('select', R.select)
    await page.fill('input[type=text]', R.login); await page.fill('input[type=password]', PASSWORD)
    await page.click('button[type=submit]')
    try {
      const code = page.locator('input[placeholder="123456"]')
      await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 }), code.waitFor({ timeout: 90000 })])
      if (await code.count()) {
        await code.fill(totp(SECRETS[R.login]))
        await page.click('button[type=submit]')
        await page.waitForURL((u) => !u.pathname.startsWith('/login') && !u.pathname.startsWith('/mfa'), { timeout: 60000 })
      }
    } catch (e) { findings.push({ role: roleKey, mode, path: '/login', problems: ['sign-in did not finish: ' + String(e.message).split('\n')[0], 'now at ' + page.url(), 'page says: ' + ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(-200)] }); await ctx.close(); continue }
    findings.push({ role: roleKey, mode, path: '(signed in)', landed: new URL(page.url()).pathname, problems: bucket.splice(0) })

    for (const p of (process.env.PAGES ? process.env.PAGES.split(',') : R.pages)) {
      bucket = []
      let final = '', text = '', overflow = false, ok = true
      try {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 120000 })
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(1200)
        final = new URL(page.url()).pathname
        text = (await page.locator('body').innerText().catch(() => '')) || ''
        overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
      } catch (e) { ok = false; bucket.push('navigation failed: ' + String(e.message).split('\n')[0]) }
      const problems = [...new Set(bucket)]
      if (ok && final !== p && !(p === '/learning' && final.startsWith('/learning'))) problems.push(`redirected to ${final}`)
      if (ok && text.trim().length < 40) problems.push('page is empty')
      if (ok && BAD_TEXT.test(text)) problems.push('error text on page: ' + (text.match(BAD_TEXT) || [''])[0])
      if (ok && mode === 'mobile' && overflow) problems.push('scrolls sideways on a phone')
      visited.push({ role: roleKey, mode, path: p, final })
      if (problems.length) {
        const shot = `${roleKey}-${mode}-${p.replace(/\W+/g, '_')}.png`
        await page.screenshot({ path: path.join(OUT, shot), fullPage: false }).catch(() => {})
        findings.push({ role: roleKey, mode, path: p, final, problems, shot })
      }
      process.stdout.write(problems.length ? 'x' : '.')
    }
    // a student session is not left behind: the lock is released when the run ends
    if (roleKey === 'student') await releaseStudent()
    await ctx.close(); process.stdout.write(`\n${roleKey}/${mode} done\n`)
  }
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify({ visited: visited.length, findings }, null, 2))
const bad = findings.filter((f) => f.problems.length)
console.log(`\nVisited ${visited.length} pages. ${bad.length} with problems.`)
for (const f of bad) console.log(`\n[${f.role}/${f.mode}] ${f.path}${f.final && f.final !== f.path ? ' -> ' + f.final : ''}\n  - ` + f.problems.join('\n  - '))
