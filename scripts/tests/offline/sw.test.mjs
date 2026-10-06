// Runs the REAL public/sw.js in a sandbox with a fake network and a fake cache, so every rule of the offline worker is tested.
// Run: node --test scripts/tests/offline/sw.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const ORIGIN = 'https://school.example.com'
const code = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8')

class FakeResponse {
  constructor(body, { status = 200, type = 'basic', redirected = false, contentType = 'text/html; charset=utf-8' } = {}) { this.body = body; this.status = status; this.ok = status >= 200 && status < 300; this.type = type; this.redirected = redirected; this.headers = { get: (n) => (n.toLowerCase() === 'content-type' ? contentType : null) } }
  async text() { return String(this.body) }
  clone() { return new FakeResponse(this.body, { status: this.status, type: this.type, redirected: this.redirected, contentType: this.headers.get('content-type') }) }
}
class FakeRequest { constructor(url, init = {}) { this.url = url; this.mode = init.mode || 'cors'; this.method = init.method || 'GET' } }

function world({ online = true, pages = {} } = {}) {
  const stores = new Map()
  const cacheOf = (name) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const m = stores.get(name)
    return { match: async (req) => m.get(typeof req === 'string' ? req : req.url), put: async (req, res) => { m.delete(typeof req === 'string' ? req : req.url); m.set(typeof req === 'string' ? req : req.url, res) }, keys: async () => [...m.keys()].map((u) => new FakeRequest(u)), delete: async (req) => m.delete(typeof req === 'string' ? req : req.url), add: async (u) => { m.set(new URL(u, ORIGIN).href, new FakeResponse('<html>offline page</html>')) } }
  }
  const state = { online, pages, fetched: [], listeners: {} }
  const caches = { open: async (n) => cacheOf(n), match: async (u) => { for (const m of stores.values()) { const h = m.get(new URL(u, ORIGIN).href); if (h) return h } }, keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) }
  const fetchFn = async (req) => {
    const url = typeof req === 'string' ? req : req.url
    state.fetched.push(url)
    if (!state.online) throw new TypeError('Failed to fetch')
    const p = state.pages[new URL(url).pathname]
    return p ? p() : new FakeResponse('<html>' + url + '</html>')
  }
  const self = { location: { origin: ORIGIN }, addEventListener: (t, fn) => { state.listeners[t] = fn }, skipWaiting: async () => {}, clients: { claim: async () => {} } }
  const ctx = vm.createContext({ self, caches, fetch: fetchFn, Request: FakeRequest, Response: FakeResponse, URL, Promise, setTimeout, clearTimeout, console })
  vm.runInContext(code, ctx)
  return { sw: self.__offlineWorker, state, stores, caches, self }
}

test('the worker only ever claims the site\'s own static files and the student flashcard and lesson pages', () => {
  const { sw } = world()
  const r = (path, mode = 'navigate', method = 'GET') => sw.routeFor(ORIGIN + path, mode, method)
  assert.equal(r('/_next/static/chunks/abc.js', 'no-cors'), 'static'); assert.equal(r('/_next/static/media/font.woff2', 'cors'), 'static')
  for (const path of ['/learning', '/learning/flashcards', '/learning/flashcards/abc', '/learning/flashcards/abc/study', '/learning/lesson/123']) assert.equal(r(path), 'page', path)
  assert.equal(r('/offline.html', 'navigate'), 'offline')
  // exams, sign-in, API, payments, teachers' pages, other student pages: never touched
  for (const path of ['/student/exam/1/take', '/student/direct-exam/1/take', '/take-exam/1/questions', '/login', '/api/chat', '/api/essay-marking', '/learning/lessons/1', '/learning/week', '/learning/library', '/learning/resources', '/teacher', '/principal', '/', '/student', '/demo-exam', '/auth/callback', '/learningx', '/learning-extra']) assert.equal(r(path), null, path)
  assert.equal(r('/learning', 'cors'), null)                                      // only real page navigations, not fetches of the same address
  assert.equal(r('/learning', 'navigate', 'POST'), null); assert.equal(r('/_next/static/a.js', 'no-cors', 'PUT'), null)
  assert.equal(sw.routeFor('https://xyz.supabase.co/rest/v1/flashcards', 'cors', 'GET'), null); assert.equal(sw.routeFor('https://evil.example.org/_next/static/a.js', 'no-cors', 'GET'), null)
  assert.equal(sw.routeFor('not a url', 'navigate', 'GET'), null)
})

test('a page is saved under its own address, ignoring what follows the ?', () => {
  const { sw } = world()
  assert.equal(sw.pageKey(ORIGIN + '/learning/flashcards/abc?x=1#top').url, ORIGIN + '/learning/flashcards/abc')
  assert.notEqual(sw.pageKey(ORIGIN + '/learning/flashcards/a').url, sw.pageKey(ORIGIN + '/learning/flashcards/b').url)
})

test('online: a page comes from the network and a copy is saved; offline: the saved copy is served', async () => {
  const w = world({ online: true })
  const req = new FakeRequest(ORIGIN + '/learning/flashcards/d1', { mode: 'navigate' })
  const live = await w.sw.pageNetworkFirst(req)
  assert.match(live.body, /learning\/flashcards\/d1/)
  w.state.online = false
  const saved = await w.sw.pageNetworkFirst(req)
  assert.match(saved.body, /learning\/flashcards\/d1/)                            // the very copy saved earlier
  w.state.online = true; w.state.pages['/learning/flashcards/d1'] = () => new FakeResponse('<html>NEW</html>')
  assert.equal((await w.sw.pageNetworkFirst(req)).body, '<html>NEW</html>')       // online always prefers the fresh page
  w.state.online = false
  assert.equal((await w.sw.pageNetworkFirst(req)).body, '<html>NEW</html>')       // ...and that becomes the saved copy
})

test('offline with nothing saved: the plain offline page, never a browser error', async () => {
  const w = world({ online: true }); await w.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning', { mode: 'navigate' }))   // caches only the shell via install below
  const w2 = world({ online: false })
  await w2.caches.open('sa-shell-v1').then((c) => c.add('/offline.html'))
  const res = await w2.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning/flashcards/never-opened', { mode: 'navigate' }))
  assert.match(res.body, /offline page/)
  const w3 = world({ online: false })                                              // not even the offline page was saved: still a clear answer
  const bare = await w3.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning', { mode: 'navigate' }))
  assert.equal(bare.status, 503); assert.match(bare.body, /offline/i)
})

test('only real pages are saved: not errors, not redirects (for example to the sign-in page), not other file types', async () => {
  const w = world({ online: true })
  const key = (p) => w.sw.pageKey(ORIGIN + p).url
  const cache = await w.caches.open(w.sw.PAGE_CACHE)
  w.state.pages['/learning/err'] = () => new FakeResponse('x', { status: 500 })
  w.state.pages['/learning/gone'] = () => new FakeResponse('x', { status: 404 })
  w.state.pages['/learning/flashcards/redir'] = () => new FakeResponse('<html>login</html>', { redirected: true })
  w.state.pages['/learning/flashcards/json'] = () => new FakeResponse('{}', { contentType: 'application/json' })
  w.state.pages['/learning/flashcards/cross'] = () => new FakeResponse('<html></html>', { type: 'cors' })
  for (const p of ['/learning/err', '/learning/gone', '/learning/flashcards/redir', '/learning/flashcards/json', '/learning/flashcards/cross']) await w.sw.pageNetworkFirst(new FakeRequest(ORIGIN + p, { mode: 'navigate' }))
  for (const p of ['/learning/err', '/learning/gone', '/learning/flashcards/redir', '/learning/flashcards/json', '/learning/flashcards/cross']) assert.equal(await cache.match(key(p)), undefined, p)
  // a bad response is still handed to the browser as it is (the worker never hides an error)
  assert.equal((await w.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning/err', { mode: 'navigate' }))).status, 500)
})

test('static files: saved the first time, then served from the copy even with no connection', async () => {
  const w = world({ online: true })
  const req = new FakeRequest(ORIGIN + '/_next/static/chunks/app.js', { mode: 'no-cors' })
  await w.sw.staticFirst(req)
  w.state.online = false; w.state.fetched.length = 0
  const again = await w.sw.staticFirst(req)
  assert.ok(again.body); assert.equal(w.state.fetched.length, 0)                  // no network was needed
  w.state.online = false
  await assert.rejects(() => w.sw.staticFirst(new FakeRequest(ORIGIN + '/_next/static/chunks/never.js', { mode: 'no-cors' })), /Failed to fetch/)   // an unsaved file simply fails, as it would anyway
})

test('a slow connection falls back to the saved copy after a short wait, but never when there is no copy', async () => {
  const w = world({ online: true })
  const req = new FakeRequest(ORIGIN + '/learning/flashcards/s', { mode: 'navigate' })
  await w.sw.pageNetworkFirst(req)                                                // saved
  w.state.pages['/learning/flashcards/s'] = () => new Promise(() => {})            // the network never answers
  const t0 = Date.now()
  const res = await w.sw.pageNetworkFirst(req)
  assert.match(res.body, /flashcards\/s/); assert.ok(Date.now() - t0 >= 4900 && Date.now() - t0 < 8000, 'waited about 5 seconds, not forever')
})

test('the browser can ask the worker to save pages ahead of time; it only saves allowed pages, at most ten, and survives being offline', async () => {
  const w = world({ online: true })
  await w.sw.savePages(['/learning', '/learning/flashcards/a/study', '/student/exam/1/take', '/api/secret', 'https://evil.example.org/learning', 42, null])
  const cache = await w.caches.open(w.sw.PAGE_CACHE)
  assert.ok(await cache.match(w.sw.pageKey(ORIGIN + '/learning'))); assert.ok(await cache.match(w.sw.pageKey(ORIGIN + '/learning/flashcards/a/study')))
  assert.equal((await cache.keys()).length, 2); assert.ok(!w.state.fetched.some((u) => /\/student\/exam|\/api\/|evil/.test(u)))     // the disallowed ones were never even requested
  w.state.online = false
  await w.sw.savePages(['/learning/flashcards/b'])                                 // no connection: quietly nothing saved, no error
  assert.equal((await cache.keys()).length, 2)
  w.state.online = true; w.state.fetched.length = 0
  await w.sw.savePages(Array.from({ length: 30 }, (_, i) => '/learning/flashcards/many' + i))
  assert.equal(w.state.fetched.length, 10)
})

test('the saved pages never grow without limit: the oldest are dropped past 60', async () => {
  const w = world({ online: true })
  for (let i = 0; i < w.sw.MAX_PAGES + 15; i++) await w.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning/flashcards/p' + i, { mode: 'navigate' }))
  await new Promise((r) => setTimeout(r, 10))
  const keys = (await (await w.caches.open(w.sw.PAGE_CACHE)).keys()).map((k) => k.url)
  assert.ok(keys.length <= w.sw.MAX_PAGES + 1, `kept ${keys.length}`)
  assert.ok(!keys.includes(ORIGIN + '/learning/flashcards/p0')); assert.ok(keys.includes(ORIGIN + '/learning/flashcards/p' + (w.sw.MAX_PAGES + 14)))
})

test('signing out clears the saved pages but keeps the plain offline page and the site\'s static files', async () => {
  const w = world({ online: true })
  await w.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning/flashcards/x', { mode: 'navigate' }))
  await w.sw.staticFirst(new FakeRequest(ORIGIN + '/_next/static/a.js', { mode: 'no-cors' }))
  await w.caches.open('sa-shell-v1').then((c) => c.add('/offline.html'))
  const waits = []
  w.state.listeners.message({ data: { type: 'clear' }, waitUntil: (p) => waits.push(p) }); await Promise.all(waits)
  const names = await w.caches.keys()
  assert.ok(!names.includes(w.sw.PAGE_CACHE)); assert.ok(names.includes(w.sw.STATIC_CACHE)); assert.ok(names.includes('sa-shell-v1'))
})

test('the worker answers only its own requests: for anything else it does not respond at all, so the browser behaves as normal', () => {
  const w = world()
  const responded = []
  const ev = (url, mode, method = 'GET') => ({ request: new FakeRequest(url, { mode, method }), respondWith: (p) => { responded.push(url); p.catch(() => {}) } })
  w.state.listeners.fetch(ev(ORIGIN + '/student/exam/1/take', 'navigate')); w.state.listeners.fetch(ev(ORIGIN + '/api/chat', 'cors', 'POST')); w.state.listeners.fetch(ev('https://x.supabase.co/rest/v1/a', 'cors'))
  assert.deepEqual(responded, [])
  w.state.listeners.fetch(ev(ORIGIN + '/_next/static/a.js', 'no-cors')); assert.equal(responded.length, 1)
})

test('installing saves the offline page, and activating removes old versions of the worker\'s own caches only', async () => {
  const w = world()
  const waits = []
  w.state.listeners.install({ waitUntil: (p) => waits.push(p) }); await Promise.all(waits)
  assert.ok(await w.caches.match('/offline.html'))
  await w.caches.open('sa-pages-v0'); await w.caches.open('someone-elses-cache')
  waits.length = 0; w.state.listeners.activate({ waitUntil: (p) => waits.push(p) }); await Promise.all(waits)
  const names = await w.caches.keys()
  assert.ok(!names.includes('sa-pages-v0')); assert.ok(names.includes('someone-elses-cache'))
})

test('saving a page also saves the scripts, styles and fonts it names, including ones listed inside it for other routes, so it opens with no signal', async () => {
  const html = '<html><link rel="stylesheet" href="/_next/static/chunks/a.css"><script src="/_next/static/chunks/main.js"></script><script>self.__next_f.push([1,"{\\"chunks\\":[\\"static/chunks/route-study.js\\",\\"/_next/static/media/font.woff2\\",\\"static/css/other.css\\"]}"])</script><img src="/logo.png"><script src="https://cdn.example.org/_next/static/evil.js"></script></html>'
  const w = world({ online: true, pages: { '/learning/flashcards/d1/study': () => new FakeResponse(html) } })
  await w.sw.savePages(['/learning/flashcards/d1/study'])
  const cache = await w.caches.open(w.sw.STATIC_CACHE)
  const saved = (await cache.keys()).map((k) => k.url.replace(ORIGIN, '')).sort()
  assert.deepEqual(saved, ['/_next/static/chunks/a.css', '/_next/static/chunks/main.js', '/_next/static/chunks/route-study.js', '/_next/static/css/other.css', '/_next/static/media/font.woff2'])   // both ways of naming a file; not the logo, not another site's file
  w.state.online = false; w.state.fetched.length = 0
  assert.ok((await w.sw.staticFirst(new FakeRequest(ORIGIN + '/_next/static/chunks/route-study.js', { mode: 'no-cors' }))).body)
  assert.equal(w.state.fetched.length, 0)
})

test('a page that is simply browsed also gets its files saved, and a failure to save them never breaks the page', async () => {
  const html = '<script src="/_next/static/chunks/x.js"></script>'
  const w = world({ online: true, pages: { '/learning': () => new FakeResponse(html) } })
  const waits = []
  const res = await w.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning', { mode: 'navigate' }), { waitUntil: (p) => waits.push(p) })
  assert.equal(res.body, html); await Promise.all(waits)
  assert.ok(await (await w.caches.open(w.sw.STATIC_CACHE)).match(new FakeRequest(ORIGIN + '/_next/static/chunks/x.js')))
  const w2 = world({ online: true, pages: { '/learning': () => new FakeResponse(html), '/_next/static/chunks/x.js': () => { throw new TypeError('Failed to fetch') } } })
  const w2waits = []
  assert.equal((await w2.sw.pageNetworkFirst(new FakeRequest(ORIGIN + '/learning', { mode: 'navigate' }), { waitUntil: (p) => w2waits.push(p) })).body, html)
  await Promise.all(w2waits)
})

test('a page naming a huge number of files is capped, so one odd page cannot fill the device', async () => {
  const html = Array.from({ length: 400 }, (_, i) => `<script src="/_next/static/chunks/c${i}.js"></script>`).join('')
  const w = world({ online: true, pages: { '/learning': () => new FakeResponse(html) } })
  await w.sw.saveAssetsFor(new FakeResponse(html))
  assert.equal((await (await w.caches.open(w.sw.STATIC_CACHE)).keys()).length, w.sw.MAX_ASSETS_PER_PAGE)
})
