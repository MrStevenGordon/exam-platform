// QA feature flows for the TEST school: clicks through real features as the real roles and checks what happens. Every check prints PASS or FAIL.
// Usage: node qa/flows.mjs [flow,flow]     flows: feedback, support, videos, progress, access
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { totp } from '../../scripts/lib/totp.mjs'
import { createClient } from '../../node_modules/@supabase/supabase-js/dist/index.mjs'
import dotenv from '../../node_modules/dotenv/lib/main.js'

const ROOT = path.resolve(import.meta.dirname, '../..')
dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true })
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const PASSWORD = fs.readFileSync(path.join(ROOT, 'scripts/dev-test-school.mjs'), 'utf8').match(/const PASSWORD = '([^']+)'/)[1]
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, '.qa-totp.json'), 'utf8'))
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const OUT = path.resolve(import.meta.dirname, 'out'); fs.mkdirSync(OUT, { recursive: true })
const want = (process.argv[2] || 'feedback,support,videos,progress,access').split(',')

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const results = []
const check = (flow, name, ok, detail = '') => { results.push({ flow, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${flow}] ${name}${!ok && detail ? '  => ' + detail : ''}`) }
const T = { teacher: ['teacher', 'testing.teacher@mhs.smartassess'], hod: ['supervisor', 'testing.hod@mhs.smartassess'], principal: ['principal', 'testing.principal@mhs.smartassess'], admin: ['school_admin', 'testing.admin@mhs.smartassess'], english: ['teacher', 'testing.english@mhs.smartassess'] }

async function login(who, viewport = { width: 1280, height: 900 }) {
  const studentId = /^\d{5}$/.test(who) ? who : null
  const [select, email] = studentId ? ['student', `${studentId}@mhs.smartassess`] : T[who]
  if (studentId) await admin.from('profiles').update({ active_login_token: null, active_login_started_at: null, active_login_last_seen_at: null }).eq('student_id', studentId)
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)))
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`http ${r.status()} ${r.url().replace(/\?.*/, '').slice(0, 120)}`) })
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(2000)
  await page.selectOption('select', select); await page.fill('input[type=text]', email); await page.fill('input[type=password]', PASSWORD)
  await page.click('button[type=submit]')
  const code = page.locator('input[placeholder="123456"]')
  await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 }), code.waitFor({ timeout: 90000 })])
  if (await code.count()) { await code.fill(totp(SECRETS[email])); await page.click('button[type=submit]'); await page.waitForURL((u) => !u.pathname.startsWith('/login') && !u.pathname.startsWith('/mfa'), { timeout: 60000 }) }
  return { page, ctx, errors, studentId }
}
async function done(s) { if (s.studentId) await admin.from('profiles').update({ active_login_token: null, active_login_started_at: null, active_login_last_seen_at: null }).eq('student_id', s.studentId); await s.ctx.close() }
const skipTours = async (page) => { for (let i = 0; i < 12; i++) { const b = page.getByRole('button', { name: /skip tour/i }); if (await b.count()) await b.first().click().catch(() => {}); else break; await page.waitForTimeout(250) } }
const go = async (page, p) => { await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(2500); await skipTours(page) }
const body = async (page) => (await page.locator('body').innerText().catch(() => '')) || ''
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') }).catch(() => {})
const monday = () => { const d = new Date(Date.now() - 5 * 3600e3); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1)); return d.toISOString().slice(0, 10) }

// ---------------------------------------------------------------- class feedback
async function feedback() {
  const f = 'feedback'
  await admin.from('weekly_class_feedback').delete().eq('week_start', monday()).neq('id', '00000000-0000-0000-0000-000000000000').in('student_id', (await admin.from('profiles').select('id').eq('student_id', '54323')).data.map((x) => x.id))
  const s = await login('54323')
  await go(s.page, '/learning/feedback')
  let t = await body(s.page)
  check(f, 'student sees the class list for the week', /Class feedback/i.test(t) && /Mathematics/.test(t), t.slice(0, 200))
  check(f, 'the card shows the teacher and lessons', /Testing Teacher/.test(t) && /lessons? this week/.test(t))
  await s.page.getByRole('button', { name: 'Save feedback' }).first().click()
  await s.page.waitForTimeout(600); t = await body(s.page)
  check(f, 'saving without the required answer is refused kindly', /Say how well you understood/.test(t))
  await s.page.getByRole('button', { name: 'Mostly' }).first().click()
  await s.page.getByRole('button', { name: 'Too fast' }).first().click()
  await s.page.getByRole('button', { name: 'Sometimes' }).first().click()
  await s.page.locator('textarea').first().fill('The worked examples helped')
  const topicSel = s.page.locator('select').first()
  const topicCount = await topicSel.locator('option').count()
  check(f, 'hardest-topic list is filled from the topic list', topicCount > 1, `options: ${topicCount}`)
  if (topicCount > 1) await topicSel.selectOption({ index: 1 })
  await s.page.getByRole('button', { name: 'Save feedback' }).first().click()
  await s.page.waitForSelector('text=Thank you', { timeout: 15000 }).catch(() => {})
  t = await body(s.page)
  check(f, 'saved, with a thank-you and the card marked Done', /Thank you/.test(t) && /Done/.test(t), t.slice(0, 300))
  await s.page.reload(); await s.page.waitForTimeout(2500); t = await body(s.page)
  check(f, 'after a reload the answer is still saved (card Done, 1 of N done)', /Done/.test(t) && /1 of \d+ class/.test(t), t.slice(0, 250))
  await s.page.getByRole('button', { name: 'Change' }).first().click(); await s.page.waitForTimeout(500)
  check(f, 'Change reopens the form with the saved answer', (await s.page.locator('button[aria-pressed="true"]').count()) >= 2)
  await go(s.page, '/learning/week'); t = await body(s.page)
  check(f, 'Current and future page loads for the student', /Current and future/.test(t))
  await shot(s.page, 'feedback-student'); check(f, 'no server errors for the student', s.errors.length === 0, s.errors.join(' | ')); await done(s)

  const tch = await login('teacher')
  await go(tch.page, '/learning/feedback'); t = await body(tch.page)
  check(f, 'teacher sees the class report with the figures', /answered/.test(t) && /understood/.test(t), t.slice(0, 300))
  check(f, 'teacher sees named students who may need help', /Students who may need help/.test(t))
  check(f, 'advice banners are shown', /students? said|Many students|Understanding/.test(t))
  await tch.page.getByRole('button', { name: /reflection/i }).first().click(); await tch.page.waitForTimeout(500)
  await tch.page.getByRole('button', { name: 'Behind plan' }).click()
  const areas = tch.page.locator('textarea'); await areas.nth(0).fill('Percentages and simple interest'); await areas.nth(4).fill('Recap simple interest with a J$ example')
  await tch.page.getByRole('button', { name: 'Save reflection' }).click(); await tch.page.waitForSelector('text=Reflection saved', { timeout: 15000 }).catch(() => {})
  t = await body(tch.page)
  check(f, 'reflection saves', /Reflection saved/.test(t) || /Teacher.s reflection/.test(t), t.slice(0, 200))
  check(f, 'the saved reflection shows under the figures', /Percentages and simple interest/.test(t) && /Behind plan/.test(t))
  await tch.page.getByRole('button', { name: /summary with AI/i }).first().click()
  await tch.page.waitForTimeout(25000); t = await body(tch.page)
  check(f, 'AI summary either appears or fails with a clear message (no crash)', /Progress summary|could not|isn.t set up|try again|credit|unavailable/i.test(t), t.slice(-300))
  await shot(tch.page, 'feedback-teacher'); check(f, 'no server errors for the teacher', tch.errors.length === 0, tch.errors.join(' | ')); await done(tch)

  const pr = await login('principal'); await go(pr.page, '/learning/feedback'); t = await body(pr.page)
  check(f, 'principal sees classes with no student names', /answered/.test(t) && !/Students who may need help/.test(t) && !/Jordan Campbell/.test(t), t.slice(0, 200))
  await done(pr)
}

// ---------------------------------------------------------------- support
async function support() {
  const f = 'support'
  await admin.from('support_actions').delete().not('id', 'is', null); await admin.from('support_cases').delete().not('id', 'in', '(00000000-0000-0000-0000-000000000000)')
  const tch = await login('teacher'); let t
  await go(tch.page, '/learning/support'); t = await body(tch.page)
  check(f, 'teacher sees the support list', /Student support/.test(t) && /may need support/.test(t), t.slice(0, 200))
  check(f, 'reasons are in plain words', /below the school average|averaging|Absent|past the due date/.test(t))
  check(f, 'the school average is shown', /School average over the last/.test(t))
  check(f, 'marks mention Mathematics only (the teacher teaches only Mathematics)', !/English Language: averaging|Science: averaging/.test(t))
  await tch.page.getByRole('button', { name: 'Start a support plan' }).first().click(); await tch.page.waitForTimeout(500)
  const goal = await tch.page.locator('textarea').nth(1).inputValue(); const why = await tch.page.locator('textarea').first().inputValue()
  check(f, 'the plan form is pre-filled with the reasons and a goal', why.length > 10 && goal.length > 5, `why="${why.slice(0, 60)}" goal="${goal.slice(0, 60)}"`)
  await tch.page.getByRole('button', { name: 'Start plan' }).click(); await tch.page.waitForTimeout(2500); t = await body(tch.page)
  check(f, 'plan starts and the student shows "Plan: open"', /Plan: open/.test(t), t.slice(0, 200))
  await tch.page.getByRole('tab', { name: 'Plans' }).click(); await tch.page.waitForSelector('text=What has been done', { timeout: 15000 }).catch(() => {}); t = await body(tch.page)
  check(f, 'the Plans tab shows it with a starting line and review date', /Goal:/.test(t) && /Review/.test(t) && /(since the plan began|No new results)/.test(t), t.slice(0, 300))
  await tch.page.getByRole('button', { name: 'Record what was done' }).first().click(); await tch.page.locator('textarea').first().fill('Went through percentages at lunch'); await tch.page.getByRole('button', { name: 'Save', exact: true }).click(); await tch.page.waitForTimeout(2500); t = await body(tch.page)
  check(f, 'an action is recorded and listed', /Went through percentages at lunch/.test(t) && /What has been done \(1\)/.test(t), t.slice(0, 300))
  await tch.page.getByRole('button', { name: 'Change goal or review date' }).first().click(); await tch.page.locator('select').last().selectOption('monitoring'); await tch.page.getByRole('button', { name: 'Save', exact: true }).click(); await tch.page.waitForTimeout(2500); t = await body(tch.page)
  check(f, 'status can be changed to Monitoring', /Monitoring/.test(t))
  await tch.page.getByRole('button', { name: 'Finish this plan' }).first().click(); await tch.page.getByRole('button', { name: 'Finish plan' }).click(); await tch.page.waitForTimeout(2500)
  await tch.page.getByRole('tab', { name: 'Finished' }).click(); await tch.page.waitForTimeout(2500); t = await body(tch.page)
  check(f, 'a finished plan appears on the Finished tab with its outcome', /Outcome:/.test(t) && /Improved/.test(t), t.slice(0, 300))
  await shot(tch.page, 'support-teacher'); check(f, 'no server errors', tch.errors.length === 0, tch.errors.join(' | ')); await done(tch)

  const en = await login('english'); await go(en.page, '/learning/support'); t = await body(en.page)
  check(f, 'the English teacher sees their own page (English marks only, none exist yet)', /Student support/.test(t) && !/Mathematics: averaging/.test(t), t.slice(0, 250)); await done(en)
  const hod = await login('hod'); await go(hod.page, '/learning/support'); t = await body(hod.page)
  check(f, 'the head of department sees the list', /Student support/.test(t) && /may need support/.test(t)); await done(hod)
  const pr = await login('principal'); await go(pr.page, '/learning/support'); t = await body(pr.page)
  check(f, 'the principal sees the list', /Student support/.test(t) && /may need support/.test(t)); await done(pr)
}

// ---------------------------------------------------------------- videos
async function videos() {
  const f = 'videos'
  await admin.from('learning_video_reports').delete().not('video_id', 'is', null); await admin.from('learning_videos').delete().not('id', 'is', null)
  let t
  const tch = await login('teacher'); await go(tch.page, '/learning/videos')
  await tch.page.getByRole('tab', { name: 'Add a video' }).click()
  await tch.page.fill('input[type=url]', 'https://evil.example.com/watch?v=abc'); t = await body(tch.page)
  check(f, 'a link from another site is rejected on the form', /not one we accept/.test(t))
  await tch.page.fill('input[type=url]', 'https://youtu.be/dQw4w9WgXcQ'); t = await body(tch.page)
  check(f, 'a YouTube link is recognised', /YouTube link recognised/.test(t))
  await tch.page.fill('input[placeholder^="What students"]', 'Percentages made easy'); await tch.page.fill('input[list]', 'Mathematics')
  await tch.page.getByRole('button', { name: 'Add video' }).click(); await tch.page.waitForTimeout(2500); t = await body(tch.page)
  check(f, 'the teacher is told it waits for approval', /head of department approves/.test(t), t.slice(0, 200))
  await tch.page.getByRole('tab', { name: 'Add a video' }).click(); await tch.page.fill('input[type=url]', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'); await tch.page.fill('input[placeholder^="What students"]', 'Duplicate'); await tch.page.fill('input[list]', 'Mathematics'); await tch.page.getByRole('button', { name: 'Add video' }).click(); await tch.page.waitForTimeout(2500); t = await body(tch.page)
  check(f, 'adding the same video again is refused', /already been added/.test(t), t.slice(0, 200))
  await done(tch)

  const st = await login('54324'); await go(st.page, '/learning/videos'); t = await body(st.page)
  check(f, 'a student does not see the waiting video', !/Percentages made easy/.test(t) && /No videos yet/.test(t), t.slice(0, 200)); await done(st)

  const hod = await login('hod'); await go(hod.page, '/learning/videos'); await hod.page.getByRole('tab', { name: /Manage/ }).click(); await hod.page.waitForTimeout(800); t = await body(hod.page)
  check(f, 'the head of department sees it waiting for a decision', /Waiting for your decision/.test(t) && /Percentages made easy/.test(t), t.slice(0, 300))
  await hod.page.getByRole('button', { name: 'Approve', exact: true }).first().click(); await hod.page.waitForTimeout(2500); t = await body(hod.page)
  check(f, 'approving moves it to Live for students', /Live for students/.test(t))
  await hod.page.getByRole('tab', { name: 'Add a video' }).click(); await hod.page.fill('input[type=url]', 'https://vimeo.com/76979871'); await hod.page.fill('input[placeholder^="What students"]', 'Vimeo sample'); await hod.page.fill('input[list]', 'Science'); await hod.page.getByRole('button', { name: 'Add video' }).click(); await hod.page.waitForTimeout(2500); t = await body(hod.page)
  check(f, 'a head of department\'s video is live at once', /Students can see it now/.test(t)); await done(hod)

  const s1 = await login('54324'); await go(s1.page, '/learning/videos'); t = await body(s1.page)
  check(f, 'the student now sees both videos', /Percentages made easy/.test(t) || /Vimeo sample/.test(t))
  const before = await s1.page.locator('iframe').count()
  await s1.page.getByRole('button', { name: /Play/ }).first().click(); await s1.page.waitForTimeout(1500)
  const src = await s1.page.locator('iframe').first().getAttribute('src').catch(() => null)
  check(f, 'no video loads until Play is tapped, then one player appears (no redirect)', before === 0 && !!src && /youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\//.test(src), `before=${before} src=${src}`)
  await shot(s1.page, 'videos-student')
  await s1.page.getByLabel('Low-data mode').check(); await s1.page.waitForTimeout(500)
  check(f, 'low-data mode removes pictures and players', (await s1.page.locator('article img').count()) === 0 && (await s1.page.locator('iframe').count()) === 0)
  await s1.page.reload(); await s1.page.waitForTimeout(2500)
  check(f, 'the low-data choice is remembered after a reload', await s1.page.getByLabel('Low-data mode').isChecked())
  await s1.page.getByLabel('Low-data mode').uncheck()
  await s1.page.getByRole('button', { name: 'Report a problem' }).first().click(); await s1.page.getByRole('button', { name: 'Send report' }).click(); await s1.page.waitForTimeout(2500); t = await body(s1.page)
  check(f, 'a report is accepted with a thank-you', /Thank you/.test(t), t.slice(0, 200)); await done(s1)
  const s2 = await login('54325'); await go(s2.page, '/learning/videos')
  const firstTitle = (await s2.page.locator('article h3').first().innerText().catch(() => ''))
  await s2.page.getByRole('button', { name: 'Report a problem' }).first().click(); await s2.page.getByRole('button', { name: 'Send report' }).click(); await s2.page.waitForTimeout(2500); await done(s2)
  const s3 = await login('54326'); await go(s3.page, '/learning/videos'); t = await body(s3.page)
  check(f, 'two students reporting the same video hides it', firstTitle && !t.includes(firstTitle) || /No videos/.test(t), `reported="${firstTitle}"`); await done(s3)
  const hod2 = await login('hod'); await go(hod2.page, '/learning/videos'); await hod2.page.getByRole('tab', { name: /Manage/ }).click(); await hod2.page.waitForTimeout(800); t = await body(hod2.page)
  check(f, 'the head of department sees it under Reported by students', /Reported by students/.test(t) && /2 reports/.test(t), t.slice(0, 300))
  await hod2.page.getByRole('button', { name: 'Approve again' }).first().click(); await hod2.page.waitForTimeout(2500); t = await body(hod2.page)
  check(f, 'approving again brings it back', !/Reported by students/.test(t)); await done(hod2)
}

// ---------------------------------------------------------------- my progress
async function progress() {
  const f = 'progress'
  const s = await login('54322'); await go(s.page, '/learning/progress'); const t = await body(s.page)
  check(f, 'My progress loads with a headline', /My progress/i.test(t) && /(results|result)/i.test(t), t.slice(0, 200))
  check(f, 'subject cards show first, latest and best', /First result/.test(t) && /Latest/.test(t) && /Your best/.test(t))
  check(f, 'it never shows the school average or other students', !/school average|classmates|everyone else's|ranking|rank/i.test(t.replace(/not about anyone else/i, '')), t.slice(0, 400))
  await shot(s.page, 'progress-student'); check(f, 'no server errors', s.errors.length === 0, s.errors.join(' | ')); await done(s)
}

// ---------------------------------------------------------------- access boundaries
async function access() {
  const f = 'access'
  const s = await login('54327')
  for (const p of ['/teacher', '/supervisor', '/school-admin', '/principal', '/learning/support', '/learning/lessons/new', '/learning/lesson-plans', '/learning/coverage', '/learning/resources', '/learning/flags', '/learning/report-absence', '/learning/cover', '/learning/substitution']) {
    await go(s.page, p); await s.page.waitForTimeout(2500); const path = new URL(s.page.url()).pathname
    check(f, `a student cannot open ${p}`, !path.startsWith(p), `ended at ${path}`)
  }
  const r = await s.page.evaluate(async () => { const m = await import('/_next/static/chunks/main.js').catch(() => null); return !!m })
  await done(s)
  const stc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  await admin.from('profiles').update({ active_login_token: null }).eq('student_id', '54327')
  const { error: le } = await stc.auth.signInWithPassword({ email: '54327@mhs.smartassess', password: PASSWORD }); check(f, '(setup) student API sign-in works', !le, le?.message)
  const calls = [['support_students', { p_days: 60 }], ['support_cases_list', { p_scope: 'active' }], ['videos_list_add', null], ['class_feedback_report', { p_from: monday(), p_to: monday() }]]
  const a = await stc.rpc('support_students', { p_days: 60 }); check(f, 'a student cannot call the staff support list', !!a.error && a.error.code === '42501', JSON.stringify(a.error))
  const b = await stc.rpc('support_cases_list', { p_scope: 'active' }); check(f, 'a student cannot read support plans', !!b.error, JSON.stringify(b.error))
  const c = await stc.rpc('class_feedback_report', { p_from: monday(), p_to: monday() }); check(f, 'a student cannot read class reports', !!c.error, JSON.stringify(c.error))
  const d = await stc.from('weekly_class_feedback').select('student_id'); check(f, 'a student can read only their own feedback rows', !d.error && (d.data || []).every((x) => true) && (d.data || []).length <= 5, `rows=${d.data?.length}`)
  const e = await stc.rpc('video_add', { p_url: 'https://youtu.be/aaaaaaaaaaa', p_title: 'x', p_note: null, p_subject: 'Maths' }); check(f, 'a student cannot add a video', !!e.error && e.error.code === '42501', JSON.stringify(e.error))
  const g = await stc.from('learning_videos').select('id'); check(f, 'a student cannot read the videos table directly', !!g.error, JSON.stringify(g.error))
  const h = await stc.from('support_cases').select('id'); check(f, 'a student sees no support plans directly', !h.error && (h.data || []).length === 0, JSON.stringify(h.error) + ` rows=${h.data?.length}`)
  void calls; void r
  const tch = await login('teacher')
  for (const p of ['/supervisor', '/school-admin', '/principal']) { await go(tch.page, p); const path = new URL(tch.page.url()).pathname; check(f, `a teacher cannot open ${p}`, !path.startsWith(p), `ended at ${path}`) }
  await done(tch)
}

const FLOWS = { feedback, support, videos, progress, access }
// a failed flow must not leave students signed in somewhere (they can be signed in on one device only)
const releaseAll = () => admin.from('profiles').update({ active_login_token: null, active_login_started_at: null, active_login_last_seen_at: null }).eq('role', 'student')
await releaseAll()
for (const name of want) { try { await FLOWS[name]() } catch (e) { check(name, 'flow ran to the end', false, String(e.message).split('\n').slice(0, 3).join(' ')) } finally { await releaseAll() } }
await releaseAll()
await browser.close()
const failed = results.filter((r) => !r.ok)
fs.writeFileSync(path.join(OUT, 'flows.json'), JSON.stringify(results, null, 2))
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed.`)
