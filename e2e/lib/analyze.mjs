// The thinking behind the glitch checker, kept free of the browser so it can be tested (scripts/tests/e2e/analyze.test.mjs):
// which pages are safe to open, what counts as a problem and how serious it is, and how the report is written.

// Pages the checker must never open. It only ever OPENS pages (it never clicks buttons or submits forms), but opening some pages
// starts something (an exam attempt), downloads a file or signs the person out.
const EXCLUDED = /(^|\/)(take|logout|signout|sign-out|delete|api|download|downloads|print|export|start|change-password|mfa|admin-login)(\/|$|\?)/i

export function isExcluded(pathAndQuery) {
  return EXCLUDED.test(pathAndQuery)
}

// Which first parts of an address each person may be sent to when following links from a page.
export const PORTALS = {
  student: ['student', 'learning', 'play'],
  teacher: ['teacher', 'learning', 'play'],
  supervisor: ['supervisor', 'teacher', 'learning', 'play'],
  principal: ['principal', 'learning', 'play'],
  school_admin: ['school-admin', 'learning', 'play'],
}
export const LANDING = { student: '/student', teacher: '/teacher', supervisor: '/supervisor', principal: '/principal', school_admin: '/school-admin' }

// A link found on a page, turned into a path to visit, or null if it should be skipped (another site, a file, an excluded page,
// another person's portal, or not a page address at all).
export function pathToVisit(href, baseUrl, role) {
  if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return null
  let u
  try { u = new URL(href, baseUrl) } catch { return null }
  if (u.origin !== new URL(baseUrl).origin) return null
  if (/\.(pdf|docx?|xlsx?|pptx?|csv|zip|png|jpe?g|webp|svg|mp4|mp3)$/i.test(u.pathname)) return null
  const first = u.pathname.split('/').filter(Boolean)[0] ?? ''
  if (!(PORTALS[role] ?? []).includes(first)) return null
  if (isExcluded(u.pathname)) return null
  return u.pathname.replace(/\/+$/, '') || '/'
}

// Noise that is not a real problem: the browser asking for the icon, a request cancelled because the page moved on, and the error
// recorder being blocked by an ad blocker.
const NOISE = [/favicon/i, /ERR_ABORTED/i, /sentry\.io/i, /ingest\./i, /Failed to load resource: net::ERR_BLOCKED_BY_CLIENT/i, /\/_next\/image/]
export const isNoise = (text) => NOISE.some((r) => r.test(text))

// Findings: { severity: 'high' | 'medium' | 'low', kind, detail }
export function findingsForPage(p) {
  const out = []
  const add = (severity, kind, detail) => out.push({ severity, kind, detail })
  if (p.status >= 500) add('high', 'Server error', `The page itself answered ${p.status}.`)
  else if (p.status >= 400) add('high', 'Page not found or refused', `The page answered ${p.status}.`)
  if (p.navError) add('high', 'Page could not be opened', p.navError)
  if (p.sentToLogin) add('high', 'Sent back to the sign-in page', 'The person was signed in but this page sent them to sign in again.')
  for (const e of p.pageErrors) add('high', 'Page crashed (script error)', e)
  if (p.blank) add('high', 'Page looks empty', 'Almost no text appeared on the page.')
  for (const b of p.banners) add('high', 'Error message shown on the page', b)
  for (const r of p.badResponses) {
    const sev = r.status >= 500 ? 'high' : /\/rest\/v1\/|\/auth\/v1\/|\/api\//.test(r.url) ? 'medium' : 'low'
    add(sev, `Request failed (${r.status})`, shorten(r.url))
  }
  for (const f of p.navError ? [] : p.failedRequests) add('medium', 'Request could not be made', `${shorten(f.url)} (${f.reason})`)
  for (const c of p.consoleErrors) add('medium', 'Error in the browser console', c)
  if (p.overflowX) add('medium', 'Page is wider than the screen', 'Scrolls sideways on this screen size.')
  for (const i of p.brokenImages) add('medium', 'Picture did not load', shorten(i))
  if (p.imgNoAlt > 0) add('low', 'Pictures with no description', `${p.imgNoAlt} picture(s) have no alt text.`)
  if (p.buttonNoName > 0) add('low', 'Buttons with no name', `${p.buttonNoName} button(s) have no text or label (a screen reader cannot say what they do).`)
  if (p.inputNoLabel > 0) add('low', 'Form fields with no label', `${p.inputNoLabel} field(s) have no label.`)
  if (p.loadMs > 6000) add('low', 'Slow to load', `${(p.loadMs / 1000).toFixed(1)} seconds.`)
  if (p.kb > 1500) add('low', 'Heavy page', `${Math.round(p.kb)} KB downloaded.`)
  return out
}

// A readable one-line version of an error from the browser tool (no colour codes, no call log).
export function cleanError(e) {
  const text = String(e?.message ?? e ?? '')
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\[\d+m/g, '').split('\n')[0].trim().slice(0, 200)
}

// The address in the settings file is still the placeholder from the example file, or is not a web address at all.
export function badBaseUrl(raw) {
  let u
  try { u = new URL(raw) } catch { return 'it is not a web address (it should start with https://)' }
  if (!/^https?:$/.test(u.protocol)) return 'it should start with https://'
  if (/(^|\.)example\.(com|org|net)$/i.test(u.hostname) || /your-/i.test(u.hostname)) return 'it is still the placeholder from the example file'
  return null
}

// A short plain description of what happened while signing in, so a stuck sign-in can be understood from the report alone.
// trace = { url, buttonText, pageText, requests: [{ method, path, status }], consoleErrors: [], pageErrors: [] }
// Only address paths (never query strings, which can hold tokens) and statuses are kept. Nothing typed into the form is included.
export function summarizeSignInTrace(t) {
  const parts = []
  parts.push(`ended on ${t.url || 'an unknown address'}`)
  if (t.buttonText) parts.push(`the button said "${t.buttonText}"`)
  if (t.pageText) parts.push(`the page said "${t.pageText}"`)
  const reqs = (t.requests || []).slice(0, 12).map((r) => `${r.method} ${r.path} -> ${r.status}`)
  parts.push(reqs.length ? `requests: ${reqs.join('; ')}` : 'no data requests were made')
  if ((t.consoleErrors || []).length) parts.push(`browser console errors: ${t.consoleErrors.slice(0, 3).join(' | ')}`)
  if ((t.pageErrors || []).length) parts.push(`script errors: ${t.pageErrors.slice(0, 3).join(' | ')}`)
  return parts.join('. ')
}

export const shorten = (s, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const ORDER = { high: 0, medium: 1, low: 2 }

// Groups identical findings so the same problem on twelve pages is one line listing the pages.
export function groupFindings(pages) {
  const map = new Map()
  for (const p of pages) {
    for (const f of findingsForPage(p)) {
      const key = `${f.severity}|${f.kind}|${f.detail}`
      const g = map.get(key) ?? { ...f, pages: [] }
      const label = `${p.path} (${p.viewport})`
      if (!g.pages.includes(label)) g.pages.push(label)
      map.set(key, g)
    }
  }
  return [...map.values()].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.pages.length - a.pages.length || a.kind.localeCompare(b.kind))
}

export function renderReport({ baseUrl, startedAt, roles, publicPages, pages, notes }) {
  const L = []
  L.push('# Glitch check report', '')
  L.push(`Site: ${baseUrl}`, `Run: ${startedAt}`, '')
  L.push('This report was made by opening pages only. Nothing was clicked, saved or submitted. It may contain names from the demo data.', '')
  if (notes.length) { L.push('## Notes about the run', ...notes.map((n) => `- ${n}`), '') }
  const groups = groupFindings(pages)
  const count = (s) => groups.filter((g) => g.severity === s).length
  L.push('## Summary', '')
  L.push(`- Pages opened: ${new Set(pages.map((p) => `${p.role}:${p.path}`)).size} (${roles.length} signed-in role${roles.length === 1 ? '' : 's'}${publicPages ? ' plus public pages' : ''})`)
  L.push(`- Problems found: ${count('high')} serious, ${count('medium')} worth fixing, ${count('low')} minor`, '')
  for (const sev of ['high', 'medium', 'low']) {
    const list = groups.filter((g) => g.severity === sev)
    if (!list.length) continue
    L.push(`## ${sev === 'high' ? 'Serious' : sev === 'medium' ? 'Worth fixing' : 'Minor'}`, '')
    for (const g of list) {
      L.push(`- **${g.kind}**: ${g.detail}`)
      L.push(`  - on ${g.pages.slice(0, 6).join(', ')}${g.pages.length > 6 ? `, and ${g.pages.length - 6} more` : ''}`)
    }
    L.push('')
  }
  const desktop = pages.filter((p) => p.viewport === 'desktop' && p.status < 400 && p.kb > 0)
  const heavy = [...desktop].sort((a, b) => b.kb - a.kb).slice(0, 10)
  if (heavy.length) {
    L.push('## Heaviest pages (data used on a first visit)', '', '| Page | Person | KB | Seconds |', '|---|---|---|---|')
    for (const p of heavy) L.push(`| ${p.path} | ${p.role} | ${Math.round(p.kb)} | ${(p.loadMs / 1000).toFixed(1)} |`)
    L.push('')
  }
  L.push('## Every page opened', '', '| Person | Page | Screen | Status | Problems | Screenshot |', '|---|---|---|---|---|---|')
  for (const p of pages) {
    const n = findingsForPage(p).length
    L.push(`| ${p.role} | ${p.path} | ${p.viewport} | ${p.status} | ${n} | ${p.screenshot ?? ''} |`)
  }
  L.push('')
  return L.join('\n')
}
