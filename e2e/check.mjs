// Glitch checker. Opens the public pages, then signs in as each person you give a login for and opens every page in their menu
// (plus a few pages those link to), on a computer-sized and a phone-sized screen. It records errors, failed requests, empty
// pages, pages that scroll sideways, and how much data each page uses, and writes a report you can send to Claude.
//
// READ ONLY: it only opens pages. It never clicks a button or submits a form (other than the sign-in form), and it skips pages
// that start an exam, download a file or change a password. Opening a lesson may mark it as started for that demo student.
//
// Usage: see e2e/README.md.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LANDING, PORTALS, badBaseUrl, cleanError, isNoise, pathToVisit, renderReport, summarizeSignInTrace } from './lib/analyze.mjs'

const BASE = (process.env.BASE_URL || '').trim().replace(/\/+$/, '')
if (!BASE) { console.error('Set BASE_URL in e2e/.env.e2e (the address of the site to check). See e2e/README.md.'); process.exit(1) }
const badUrl = badBaseUrl(BASE)
if (badUrl) { console.error(`BASE_URL is not right: ${badUrl}.\nOpen e2e/.env.e2e, put the real address of the Manchester site on the BASE_URL line (no slash at the end), save, and run again.`); process.exit(1) }
const MAX_PAGES = Number(process.env.MAX_PAGES_PER_PERSON || 40)
const HEADED = process.env.HEADED === '1'
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean)
const OUT = resolve(import.meta.dirname, 'report')
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } }

const PEOPLE = [
  { role: 'student', label: 'Student', login: process.env.STUDENT_LOGIN, password: process.env.STUDENT_PASSWORD },
  { role: 'teacher', label: 'Teacher', login: process.env.TEACHER_LOGIN, password: process.env.TEACHER_PASSWORD },
  { role: 'supervisor', label: 'HOD', login: process.env.HOD_LOGIN, password: process.env.HOD_PASSWORD },
  { role: 'principal', label: 'Principal', login: process.env.PRINCIPAL_LOGIN, password: process.env.PRINCIPAL_PASSWORD },
  { role: 'school_admin', label: 'School admin', login: process.env.ADMIN_LOGIN, password: process.env.ADMIN_PASSWORD },
].filter((p) => p.login && p.password && (ONLY.length === 0 || ONLY.includes(p.role) || ONLY.includes(p.label.toLowerCase())))

// Smart Learning is reached through the product switcher rather than the menu, so it is added as a starting point.
const START_EXTRA = { student: ['/learning'], teacher: ['/learning', '/learning/lesson-plans'], supervisor: ['/learning'], principal: ['/learning'], school_admin: ['/learning'] }

const PUBLIC_PAGES = ['/', '/login', '/how-it-works', '/products', '/contact', '/privacy', '/terms', '/find-my-school', '/forgot-password', '/demo-exam']

const pages = []
const notes = []
const slug = (p) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 60))

async function openPage(page, role, path, viewport, { weigh }) {
  const rec = { role, path, viewport, status: 0, loadMs: 0, kb: 0, consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [], banners: [], brokenImages: [], overflowX: false, blank: false, sentToLogin: false, imgNoAlt: 0, buttonNoName: 0, inputNoLabel: 0, screenshot: null }
  let bytes = 0
  const sized = []
  const onConsole = (m) => { if (m.type() === 'error' && !isNoise(m.text())) rec.consoleErrors.push(m.text().slice(0, 300)) }
  const onPageError = (e) => rec.pageErrors.push(String(e.message || e).slice(0, 300))
  const onFailed = (r) => { const reason = r.failure()?.errorText || 'failed'; if (!isNoise(r.url()) && !isNoise(reason)) rec.failedRequests.push({ url: r.url(), reason }) }
  const onResponse = (r) => { if (r.status() >= 400 && !isNoise(r.url())) rec.badResponses.push({ url: r.url(), status: r.status() }) }
  const onFinished = async (r) => { try { const s = await r.sizes(); const b = (s.responseBodySize || 0) + (s.responseHeadersSize || 0); bytes += b; const t = r.timing(); const u = new URL(r.url()); sized.push({ path: u.origin === new URL(BASE).origin ? u.pathname : `${u.host}${u.pathname}`, kb: b / 1024, ms: t && t.responseEnd > 0 ? Math.round(t.responseEnd) : 0 }) } catch { /* ignore */ } }
  page.on('console', onConsole); page.on('pageerror', onPageError); page.on('requestfailed', onFailed); page.on('response', onResponse); page.on('requestfinished', onFinished)
  const t0 = Date.now()
  try {
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
    rec.status = res?.status() ?? 0
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)
    rec.loadMs = Date.now() - t0
    const finalPath = new URL(page.url()).pathname
    rec.sentToLogin = role !== 'public' && finalPath.startsWith('/login') && !path.startsWith('/login')
    const facts = await page.evaluate(() => {
      const text = (document.body.innerText || '').trim()
      const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
      const banners = [...document.querySelectorAll('.banner-danger, [role="alert"]')].filter(visible).map((e) => e.innerText.trim().slice(0, 200)).filter(Boolean)
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc)
      const noAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).length
      const noName = [...document.querySelectorAll('button, [role="button"]')].filter((b) => visible(b) && !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title') && !b.querySelector('img[alt]')).length
      const noLabel = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')].filter((i) => visible(i) && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') && !(i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`)) && !i.closest('label')).length
      return { textLen: text.length, banners, broken, noAlt, noName, noLabel, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, links: [...document.querySelectorAll('nav a[href], aside a[href]')].map((a) => a.getAttribute('href')), mainLinks: [...document.querySelectorAll('main a[href], [class*="page-container"] a[href]')].map((a) => a.getAttribute('href')) }
    })
    rec.blank = facts.textLen < 40
    rec.banners = facts.banners; rec.brokenImages = facts.broken; rec.imgNoAlt = facts.noAlt; rec.buttonNoName = facts.noName; rec.inputNoLabel = facts.noLabel
    rec.overflowX = facts.overflow
    rec.navLinks = facts.links; rec.mainLinks = facts.mainLinks
    mkdirSync(join(OUT, role), { recursive: true })
    rec.screenshot = `${role}/${slug(path)}-${viewport}.jpg`
    await page.screenshot({ path: join(OUT, rec.screenshot), type: 'jpeg', quality: 55, fullPage: true }).catch(() => { rec.screenshot = null })
  } catch (e) {
    rec.status = rec.status || 0
    rec.navError = cleanError(e)
  } finally {
    await page.waitForTimeout(50)
    page.off('console', onConsole); page.off('pageerror', onPageError); page.off('requestfailed', onFailed); page.off('response', onResponse); page.off('requestfinished', onFinished)
  }
  rec.kb = weigh ? bytes / 1024 : 0
  rec.top = weigh ? sized.sort((a, b) => b.kb - a.kb).slice(0, 5).map((x) => ({ path: x.path.slice(0, 90), kb: Math.round(x.kb * 10) / 10, ms: x.ms })) : []
  const { navLinks, mainLinks, ...clean } = rec
  pages.push(clean)
  return { navLinks: navLinks || [], mainLinks: mainLinks || [], sentToLogin: rec.sentToLogin }
}

async function signIn(page, person) {
  // While signing in, note what the page and the network did (paths and statuses only, never anything typed or any token), so a
  // sign-in that gets stuck can be understood from the report.
  const trace = { url: '', buttonText: '', pageText: '', requests: [], consoleErrors: [], pageErrors: [] }
  const onResponse = (r) => { try { const u = new URL(r.url()); if (/\/(auth|rest|rpc)\/v1\//.test(u.pathname) || u.pathname.startsWith('/api/')) trace.requests.push({ method: r.request().method(), path: u.pathname, status: r.status() }) } catch { /* ignore */ } }
  const onConsole = (m) => { if (m.type() === 'error' && !isNoise(m.text())) trace.consoleErrors.push(m.text().slice(0, 160)) }
  const onPageError = (e) => trace.pageErrors.push(String(e.message || e).slice(0, 160))
  page.on('response', onResponse); page.on('console', onConsole); page.on('pageerror', onPageError)
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('select', { timeout: 15000 })
    await page.selectOption('select', person.role)
    await page.fill('form input:not([type=password]):not([type=hidden])', person.login)
    await page.fill('form input[type=password]', person.password)
    await page.click('form button[type=submit]')
    // Either the person is signed in, or the page asks for the code from their authenticator app (two-step sign-in).
    const codeBox = page.locator('input[placeholder="123456"]')
    const first = await Promise.race([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 }).then(() => 'arrived').catch(() => null),
      codeBox.waitFor({ state: 'visible', timeout: 25000 }).then(() => 'code').catch(() => null),
    ])
    if (first === 'arrived') return { ok: true, path: new URL(page.url()).pathname }
    if (first === 'code') {
      // The checker never stores or guesses codes. In a visible window the person types the code themselves and the checker waits.
      if (!HEADED) return { ok: false, why: 'This account uses two-step sign-in and needs a code from an authenticator app. Run again with HEADED=1 (see e2e/README.md) so you can type the code yourself; this person was skipped.' }
      process.stdout.write('\x07')
      console.log(`  ${person.label} needs a code: type the 6 digit code from your authenticator app into the Chrome window and press the button. Waiting up to 3 minutes...`)
      const done = await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 }).then(() => true).catch(() => false)
      if (done) return { ok: true, path: new URL(page.url()).pathname }
      return { ok: false, why: 'No correct code was entered within 3 minutes, so this person was skipped.' }
    }
    const mfa = await page.locator('input[placeholder="123456"]').count()
    if (mfa) return { ok: false, why: 'This account uses two-step sign-in and needs a code from an authenticator app. Run again with HEADED=1 so you can type the code yourself; this person was skipped.' }
    const msg = (await page.locator('.banner-danger, [role="alert"]').first().innerText().catch(() => '')).trim()
    if (msg) return { ok: false, why: `Sign-in refused: ${msg}` }
    // Stuck with no message: record what is on the screen. The typed login and password are cleared first, so they are not in the screenshot.
    trace.url = new URL(page.url()).origin + new URL(page.url()).pathname
    trace.buttonText = (await page.locator('form button[type=submit]').first().innerText().catch(() => '')).trim().slice(0, 60)
    trace.pageText = ((await page.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 240)
    await page.fill('form input:not([type=password]):not([type=hidden])', '').catch(() => {})
    await page.fill('form input[type=password]', '').catch(() => {})
    mkdirSync(join(OUT, person.role), { recursive: true })
    await page.screenshot({ path: join(OUT, person.role, 'signin-stuck.jpg'), type: 'jpeg', quality: 55, fullPage: true }).catch(() => {})
    return { ok: false, why: `Sign-in did not finish and no error was shown (waited 25 seconds). ${summarizeSignInTrace(trace)}. Screenshot: ${person.role}/signin-stuck.jpg` }
  } finally {
    page.off('response', onResponse); page.off('console', onConsole); page.off('pageerror', onPageError)
  }
}

// Signing out matters most for students: a student can be signed in on one device at a time, so leaving the session open would lock
// that demo student out of their own account for ten minutes.
async function signOut(page, person) {
  try {
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto(BASE + LANDING[person.role], { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
    const btn = page.locator('button:has-text("Log out")').first()
    if (await btn.count()) { await btn.click(); await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 10000 }).catch(() => {}) }
  } catch { /* the browser is closed straight after */ }
}

async function main() {
  const startedAt = new Date().toISOString()
  mkdirSync(OUT, { recursive: true })
  // Is the site reachable at all? Stop early with a plain message instead of a report full of the same failure.
  try { const r = await fetch(BASE + '/login', { signal: AbortSignal.timeout(20000), redirect: 'follow' }); if (r.status >= 500) throw new Error(`the site answered ${r.status}`) }
  catch (e) { console.error(`Could not reach ${BASE}/login (${cleanError(e.cause ?? e)}).\nCheck BASE_URL in e2e/.env.e2e, and that you are online.`); process.exit(1) }
  let browser
  try { browser = await chromium.launch({ channel: 'chrome', headless: !HEADED }) }
  catch (e) { console.error('Could not start Google Chrome. Install Chrome, or see e2e/README.md. Details:', e.message); process.exit(1) }

  // 1. public pages, no sign-in
  console.log('Checking public pages...')
  for (const vp of Object.keys(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[vp] })
    const page = await ctx.newPage()
    for (const p of PUBLIC_PAGES) { console.log(`  ${vp} ${p}`); await openPage(page, 'public', p, vp, { weigh: vp === 'desktop' }) }
    await ctx.close()
  }

  // 2. each person
  for (const person of PEOPLE) {
    console.log(`\nSigning in as ${person.label}...`)
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop })
    const page = await ctx.newPage()
    const result = await signIn(page, person).catch((e) => ({ ok: false, why: `Sign-in could not be completed: ${cleanError(e)}` }))
    if (!result.ok) { notes.push(`${person.label}: ${result.why}`); console.log(`  skipped: ${result.why}`); await ctx.close(); continue }
    if (result.path.startsWith('/change-password')) notes.push(`${person.label}: this account is still on its starting password, so the site asked for a new one. The checker did not change it and carried on from the home page. Some pages may behave differently once the password is changed.`)
    // Crawl: the home page, then every menu link, then a few links from each of those pages.
    const queue = [LANDING[person.role], ...(START_EXTRA[person.role] ?? [])]
    const seen = new Set()
    const order = []
    let ended = false
    while (queue.length && order.length < MAX_PAGES && !ended) {
      const path = queue.shift()
      if (seen.has(path)) continue
      seen.add(path); order.push(path)
      console.log(`  desktop ${path}`)
      const found = await openPage(page, person.role, path, 'desktop', { weigh: true })
      if (found.sentToLogin) { notes.push(`${person.label}: the site sent the signed-in person back to the sign-in page at ${path}; the rest of their pages were not checked.`); ended = true; break }
      const nav = found.navLinks.map((h) => pathToVisit(h, BASE, person.role)).filter(Boolean)
      const inPage = found.mainLinks.map((h) => pathToVisit(h, BASE, person.role)).filter(Boolean)
      for (const n of nav) if (!seen.has(n) && !queue.includes(n)) queue.push(n)
      // follow a few links from the page itself (such as the first exam in a list), but only from pages in the menu
      if (order.length <= 20) for (const l of inPage.filter((x) => !seen.has(x) && !queue.includes(x)).slice(0, 2)) queue.push(l)
      await page.waitForTimeout(300)
    }
    if (queue.length && order.length >= MAX_PAGES) notes.push(`${person.label}: stopped after ${MAX_PAGES} pages (set MAX_PAGES_PER_PERSON to raise it).`)
    // Same pages on a phone-sized screen.
    if (!ended) {
      await page.setViewportSize(VIEWPORTS.mobile)
      for (const path of order) { console.log(`  mobile  ${path}`); await openPage(page, person.role, path, 'mobile', { weigh: false }); await page.waitForTimeout(200) }
    }
    await signOut(page, person)
    await ctx.close()
  }
  await browser.close()

  const report = renderReport({ baseUrl: BASE, startedAt, roles: PEOPLE, publicPages: true, pages, notes })
  writeFileSync(join(OUT, 'report.md'), report)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ baseUrl: BASE, startedAt, notes, pages }, null, 2))
  console.log(`\nDone. Report: ${join(OUT, 'report.md')}\nScreenshots are in ${OUT}`)
}

main().catch((e) => { console.error('The check stopped:', e); process.exit(1) })
