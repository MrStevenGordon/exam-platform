// Run: node --test scripts/tests/e2e/analyze.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isExcluded, pathToVisit, isNoise, findingsForPage, groupFindings, renderReport, cleanError, badBaseUrl, summarizeSignInTrace, isExpectedProbe, PORTALS } from '../../../e2e/lib/analyze.mjs'

const BASE = 'https://school.example.com'
const clean = (o = {}) => ({ role: 'student', path: '/student', viewport: 'desktop', status: 200, loadMs: 800, kb: 400, consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [], banners: [], brokenImages: [], overflowX: false, blank: false, sentToLogin: false, imgNoAlt: 0, buttonNoName: 0, inputNoLabel: 0, screenshot: 'student/student-desktop.jpg', ...o })

test('pages that start an exam, download, sign out or change a password are never opened', () => {
  for (const p of ['/student/exam/abc/take', '/student/direct-exam/1/take', '/logout', '/api/anything', '/teacher/export', '/student/download', '/change-password', '/mfa', '/teacher/print', '/admin-login']) assert.equal(isExcluded(p), true, p)
  for (const p of ['/student', '/student/exams', '/teacher/insight', '/learning/lesson/123', '/student/takeaway-notes']) assert.equal(isExcluded(p), false, p)
})

test('links are turned into paths to visit only when they are safe and belong to that person', () => {
  assert.equal(pathToVisit('/student/exams', BASE, 'student'), '/student/exams')
  assert.equal(pathToVisit('/student/exams/', BASE, 'student'), '/student/exams')
  assert.equal(pathToVisit(`${BASE}/learning`, BASE, 'student'), '/learning')
  assert.equal(pathToVisit('/learning/lesson/9?tab=2', BASE, 'student'), '/learning/lesson/9')
  assert.equal(pathToVisit('/teacher', BASE, 'student'), null, 'a student never follows teacher links')
  assert.equal(pathToVisit('/teacher/insight', BASE, 'supervisor'), '/teacher/insight', 'an HOD uses some teacher pages')
  assert.equal(pathToVisit('https://other.example.org/student', BASE, 'student'), null)
  assert.equal(pathToVisit('mailto:a@b.c', BASE, 'student'), null)
  assert.equal(pathToVisit('#top', BASE, 'student'), null)
  assert.equal(pathToVisit('javascript:void(0)', BASE, 'student'), null)
  assert.equal(pathToVisit('/student/exam/1/take', BASE, 'student'), null)
  assert.equal(pathToVisit('/student/report.pdf', BASE, 'student'), null)
  assert.equal(pathToVisit('', BASE, 'student'), null); assert.equal(pathToVisit(null, BASE, 'student'), null)
  assert.ok(PORTALS.school_admin.includes('school-admin'))
})

test('background noise is ignored', () => {
  assert.equal(isNoise('GET /favicon.ico 404'), true)
  assert.equal(isNoise('net::ERR_ABORTED'), true)
  assert.equal(isNoise('https://o123.ingest.sentry.io/api/1/envelope/'), true)
  assert.equal(isNoise('TypeError: x is undefined'), false)
})

test('a healthy page has no findings', () => assert.deepEqual(findingsForPage(clean()), []))

test('the serious problems are marked serious', () => {
  const kinds = (o) => findingsForPage(clean(o)).filter((f) => f.severity === 'high').map((f) => f.kind)
  assert.deepEqual(kinds({ status: 500 }), ['Server error'])
  assert.deepEqual(kinds({ status: 404 }), ['Page not found or refused'])
  assert.deepEqual(kinds({ sentToLogin: true }), ['Sent back to the sign-in page'])
  assert.deepEqual(kinds({ pageErrors: ['boom'] }), ['Page crashed (script error)'])
  assert.deepEqual(kinds({ blank: true }), ['Page looks empty'])
  assert.deepEqual(kinds({ banners: ['Could not load your results.'] }), ['Error message shown on the page'])
  assert.deepEqual(kinds({ badResponses: [{ url: 'https://x.supabase.co/rest/v1/q', status: 503 }] }), ['Request failed (503)'])
})

test('lesser problems are medium or minor, and a failing data request is more important than a missing picture', () => {
  const sev = (o, kind) => findingsForPage(clean(o)).find((f) => f.kind === kind)?.severity
  assert.equal(sev({ consoleErrors: ['x'] }, 'Error in the browser console'), 'medium')
  assert.equal(sev({ overflowX: true }, 'Page is wider than the screen'), 'medium')
  assert.equal(sev({ badResponses: [{ url: 'https://x.supabase.co/rest/v1/questions', status: 403 }] }, 'Request failed (403)'), 'medium')
  assert.equal(sev({ badResponses: [{ url: 'https://x.com/logo.png', status: 404 }] }, 'Request failed (404)'), 'low')
  assert.equal(sev({ imgNoAlt: 2 }, 'Pictures with no description'), 'low')
  assert.equal(sev({ loadMs: 9000 }, 'Slow to load'), 'low')
  assert.equal(sev({ kb: 2000 }, 'Heavy page'), 'low')
})

test('the same problem on several pages becomes one line listing the pages, serious first', () => {
  const pages = [clean({ path: '/student', consoleErrors: ['same error'] }), clean({ path: '/student/exams', consoleErrors: ['same error'] }), clean({ path: '/student/tests', pageErrors: ['crash'] })]
  const g = groupFindings(pages)
  assert.equal(g[0].severity, 'high'); assert.equal(g[0].kind, 'Page crashed (script error)')
  const same = g.find((x) => x.detail === 'same error')
  assert.deepEqual(same.pages, ['/student (desktop)', '/student/exams (desktop)'])
})

test('the report says what was opened, lists the problems and the heaviest pages, and mentions notes', () => {
  const pages = [clean({ kb: 900 }), clean({ path: '/student/exams', kb: 1200, consoleErrors: ['oops'] }), clean({ path: '/student/exams', viewport: 'mobile', kb: 0, overflowX: true })]
  const md = renderReport({ baseUrl: BASE, startedAt: '2026-10-06T10:00:00Z', roles: [{ role: 'student' }], publicPages: true, pages, notes: ['Teacher: sign-in refused.'] })
  assert.match(md, /# Glitch check report/); assert.match(md, /Nothing was clicked, saved or submitted/)
  assert.match(md, /Teacher: sign-in refused\./); assert.match(md, /Pages opened: 2/)
  assert.match(md, /Error in the browser console/); assert.match(md, /Page is wider than the screen/)
  assert.match(md, /Heaviest pages/); assert.ok(md.indexOf('/student/exams | student | 1200') < md.indexOf('/student | student | 900'))
  assert.match(md, /student\/student-desktop\.jpg/)
})

test('the report never contains anything typed into the sign-in form', () => {
  const md = renderReport({ baseUrl: BASE, startedAt: 'x', roles: [], publicPages: false, pages: [clean()], notes: [] })
  assert.doesNotMatch(md, /password/i)
})

test('a page that could not be opened is one clear finding, not a crash plus a pile of failed requests', () => {
  const f = findingsForPage(clean({ status: 0, navError: 'page.goto: net::ERR_NAME_NOT_RESOLVED at https://x.test/', failedRequests: [{ url: 'https://x.test/', reason: 'net::ERR_NAME_NOT_RESOLVED' }] }))
  assert.deepEqual(f.map((x) => x.kind), ['Page could not be opened'])
})

test('browser tool errors are cut down to one readable line', () => {
  const raw = new Error('page.goto: net::ERR_NAME_NOT_RESOLVED at https://x.test/login\nCall log:\n\u001b[2m  - navigating to "https://x.test/login"\u001b[22m')
  assert.equal(cleanError(raw), 'page.goto: net::ERR_NAME_NOT_RESOLVED at https://x.test/login')
  assert.equal(cleanError('plain'), 'plain'); assert.equal(cleanError(null), '')
  assert.ok(cleanError('x'.repeat(500)).length <= 200)
})

test('the placeholder or a malformed site address is refused before anything runs', () => {
  assert.match(badBaseUrl('https://your-manchester-site.example.com'), /placeholder/)
  assert.match(badBaseUrl('https://example.com'), /placeholder/)
  assert.match(badBaseUrl('manchester.smartassessja.com'), /web address/)
  assert.match(badBaseUrl('ftp://x.test'), /https/)
  assert.equal(badBaseUrl('https://exam-platform-chi.vercel.app'), null)
  assert.equal(badBaseUrl('http://localhost:3100'), null)
})

test('a stuck sign-in is described from what the page and network did, and nothing typed is included', () => {
  const text = summarizeSignInTrace({ url: 'https://s.example/login', buttonText: 'Signing in...', pageText: 'Welcome Back Sign in to your portal', requests: [{ method: 'POST', path: '/auth/v1/token', status: 200 }, { method: 'GET', path: '/rest/v1/profiles', status: 500 }], consoleErrors: ['boom'], pageErrors: [] })
  assert.match(text, /ended on https:\/\/s\.example\/login/); assert.match(text, /button said "Signing in\.\.\."/)
  assert.match(text, /POST \/auth\/v1\/token -> 200; GET \/rest\/v1\/profiles -> 500/); assert.match(text, /browser console errors: boom/)
  assert.doesNotMatch(text, /\?/)
  assert.match(summarizeSignInTrace({ url: '', requests: [] }), /no data requests were answered/)
  assert.match(summarizeSignInTrace({ url: '', requests: [], sent: ['POST /auth/v1/token'], failed: ['/x net::ERR'] }), /sent but never answered: POST \/auth\/v1\/token.*failed: \/x net::ERR/)
})

test('the report says which files made the heaviest pages heavy', () => {
  const pages = [clean({ path: '/student', kb: 900, top: [{ path: '/_next/image', kb: 400, ms: 3000 }, { path: '/_next/static/chunks/a.js', kb: 150, ms: 800 }] }), clean({ path: '/student/exams', kb: 100, top: [{ path: '/x', kb: 50, ms: 0 }] })]
  const md = renderReport({ baseUrl: BASE, startedAt: 'x', roles: [], publicPages: false, pages, notes: [] })
  assert.match(md, /What made the heaviest pages heavy/); assert.match(md, /\*\*\/student\*\* \(student\):/)
  assert.match(md, /- \/_next\/image: 400 KB, finished at 3\.0 s/); assert.match(md, /- \/x: 50 KB/)
})

test('the app\'s deliberate "is this feature installed?" request is not reported as a failure', () => {
  assert.equal(isExpectedProbe('https://x.supabase.co/rest/v1/rpc/cancel_teacher_absence', 400), true)
  assert.equal(isExpectedProbe('https://x.supabase.co/rest/v1/rpc/cancel_teacher_absence', 500), false)
  assert.equal(isExpectedProbe('https://x.supabase.co/rest/v1/rpc/something_else', 400), false)
})
