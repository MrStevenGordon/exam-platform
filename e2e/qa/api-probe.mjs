// Calls the sensitive API routes as a signed-out visitor, a student and a teacher, with empty bodies, and shows the status each one answers with.
// Skips cron, webhook, notification, public-form and Play routes (they would send mail or create rows, or use a separate login).
import { b, log, session } from './lib.mjs'
const ID = '00000000-0000-4000-8000-000000000001'
const routes = [
  'owner/curriculum', `owner/curriculum/${ID}`, 'owner/curriculum/search', 'owner/library/books', `owner/library/books/${ID}`, `owner/library/books/${ID}/files`, `owner/library/books/${ID}/status`, `owner/library/files/${ID}`,
  'create-user', 'school-requests/decide', 'school-requests/provision-complete', 'school-requests/update-portal-url', 'org-requests/decide', 'organization-subscriptions/grant', 'school-subscriptions/grant', 'school-features/configure', 'school-features/current',
  'library/admin/books', 'library/books', `library/books/${ID}`, `library/files/${ID}/url`, 'cleanup-org-sessions', 'review-exam', 'import-pdf-exam', 'draft-questions', 'draft-questions/usage', 'essay-marking', 'essay-marking/usage', 'essay-integrity-check',
  'lesson-plans/generate', 'lesson-plans/library', 'lesson-plans/library/publish', 'set-student-accommodation', 'learning/student-draft', 'learning/tutor', 'learning/tutor-consent', 'chat', 'polish-question', 'class-feedback/summary', 'stripe-checkout',
  'substitution/cancel-absence', 'school-setup/claim', 'org-setup/claim', 'verify-signup-guard',
]
const anon = await (await b.newContext()).newPage()
const roles = { student: await session('student', '54328@mhs.smartassess'), teacher: await session('teacher', 'testing.teacher@mhs.smartassess') }
const tokenOf = (s) => s.page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /auth-token/.test(x)); if (k) return JSON.parse(localStorage[k]).access_token; const m = document.cookie.match(/sb-[^=]*auth-token[^=]*=([^;]+)/); return null })
const toks = {}; for (const [k, s] of Object.entries(roles)) { toks[k] = await s.page.evaluate(async () => { const c = await cookieStore.getAll(); const parts = c.filter((x) => /auth-token/.test(x.name)).sort((a, b) => a.name.localeCompare(b.name)); let v = parts.map((x) => x.value).join(''); if (v.startsWith('base64-')) v = atob(v.slice(7)); try { return JSON.parse(v).access_token } catch { return null } }) }
log('tokens found:', Object.entries(toks).map(([k, v]) => `${k}=${v ? 'yes' : 'NO'}`).join(' '))
const call = async (page, tok, route, method) => {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, data: method === 'POST' ? JSON.stringify({ accessToken: tok || undefined }) : undefined, failOnStatusCode: false, timeout: 30000 }
  try { const r = await page.request.fetch('http://localhost:3000/api/' + route, opts); return r.status() } catch (e) { return 'err' }
}
const rows = []
for (const route of routes) for (const method of ['GET', 'POST']) {
  const a = await call(anon, null, route, method); const st = await call(roles.student.page, toks.student, route, method); const t = await call(roles.teacher.page, toks.teacher, route, method)
  rows.push({ route, method, a, st, t })
}
const bad = (v) => v === 200 || v === 201 || (typeof v === 'number' && v >= 500)
for (const r of rows) log(`${r.method.padEnd(4)} ${r.route.padEnd(52)} anon=${String(r.a).padEnd(4)} student=${String(r.st).padEnd(4)} teacher=${String(r.t).padEnd(4)}${(bad(r.a) || bad(r.st) || bad(r.t)) ? '   <-- CHECK' : ''}`)
await b.close()
