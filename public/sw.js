/* Smart Assess Ja offline worker.
 *
 * What it does, and only this:
 *   1. keeps a copy of the site's own scripts and styles (/_next/static/), which never change once published, so pages can start without signal;
 *   2. keeps the most recent copy of the student pages for flashcards and lessons, and serves it when there is no connection;
 *   3. shows a plain "you are offline" page when a page was never saved.
 * It never touches exams, sign-in, the API, other sites, or anything that is not a plain GET, so it cannot get in the way of those.
 * What a student studies offline (their cards, lessons already opened) lives in the app's own storage, not here: these pages are only the
 * empty frames that show it, with no names or answers in them.
 * Tested by scripts/tests/offline/sw.test.mjs. Bump VERSION when this file's behaviour changes. */

const VERSION = 'v1'
const STATIC_CACHE = 'sa-static-' + VERSION
const PAGE_CACHE = 'sa-pages-' + VERSION
const SHELL_CACHE = 'sa-shell-' + VERSION
const OFFLINE_URL = '/offline.html'
const MAX_PAGES = 60
const MAX_ASSETS_PER_PAGE = 150
const NETWORK_WAIT_MS = 5000     // with a saved copy to fall back on, how long to wait for a slow connection before using it

// Which requests are ours. Everything else returns null and is left completely alone.
function routeFor(rawUrl, mode, method) {
  if (method !== 'GET') return null
  let u
  try { u = new URL(rawUrl) } catch (e) { return null }
  if (u.origin !== self.location.origin) return null
  const p = u.pathname
  if (p.startsWith('/_next/static/')) return 'static'
  if (p === OFFLINE_URL) return 'offline'
  if (mode === 'navigate' && (p === '/learning' || p.startsWith('/learning/flashcards') || p.startsWith('/learning/lesson/'))) return 'page'
  return null
}

// One saved copy per page address, whatever is after the ? (so each deck and each lesson has its own).
function pageKey(rawUrl) {
  const u = new URL(rawUrl)
  return new Request(u.origin + u.pathname)
}

const isSavable = (res) => res && res.ok && res.type === 'basic' && !res.redirected && /text\/html/i.test(res.headers.get('content-type') || '')

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i])
}

// A saved page is only useful if the scripts and styles it names are saved too. Files loaded before this worker took control never passed
// through it, so each page the worker saves is read for the /_next/static/ files it refers to (including the ones listed inside it for
// other parts of the app) and any missing are saved now.
async function saveAssetsFor(res) {
  let html = ''
  try { html = await res.clone().text() } catch (e) { return }
  // Two ways a page names these files: a full /_next/static/... path, and the shorter static/chunks/... listed in the page's own data. Only
  // ones that start at a quote, bracket or space are taken, never a path inside some other website's address.
  const names = []
  for (const m of html.matchAll(/(?<=["'(=\s\\,\[])\/_next\/static\/[A-Za-z0-9_\-./%~]+/g)) names.push(m[0])
  for (const m of html.matchAll(/(?<=["'\\,\[])static\/(?:chunks|media|css)\/[A-Za-z0-9_\-./%~]+/g)) names.push('/_next/' + m[0])
  const found = Array.from(new Set(names)).slice(0, MAX_ASSETS_PER_PAGE)
  const cache = await caches.open(STATIC_CACHE)
  for (const path of found) {
    const req = new Request(self.location.origin + path)
    if (await cache.match(req)) continue
    try { const r = await fetch(req); if (r && r.ok && r.type === 'basic') await cache.put(req, r) } catch (e) { /* offline right now: saved next time */ }
  }
}

async function staticFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok && res.type === 'basic') cache.put(request, res.clone())
  return res
}

async function pageNetworkFirst(request, event) {
  const cache = await caches.open(PAGE_CACHE)
  const key = pageKey(request.url)
  const saved = await cache.match(key)
  try {
    const live = fetch(request)
    const res = saved
      ? await Promise.race([live, new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), NETWORK_WAIT_MS))])
      : await live
    if (isSavable(res)) {
      await cache.put(key, res.clone()); trim(cache)
      const assets = saveAssetsFor(res.clone())
      if (event) event.waitUntil(assets)      // keep the worker alive until the page's files are saved too
    }
    return res
  } catch (e) {
    if (saved) return saved
    const shell = await caches.match(OFFLINE_URL)
    return shell || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function savePages(urls) {
  const cache = await caches.open(PAGE_CACHE)
  for (const raw of (Array.isArray(urls) ? urls : []).slice(0, 10)) {
    if (typeof raw !== 'string' || routeFor(new URL(raw, self.location.origin).href, 'navigate', 'GET') !== 'page') continue
    try {
      const res = await fetch(new URL(raw, self.location.origin).href, { credentials: 'same-origin' })
      if (isSavable(res)) { await cache.put(pageKey(new URL(raw, self.location.origin).href), res.clone()); await saveAssetsFor(res) }
    } catch (e) { /* offline right now: the page is simply not saved */ }
  }
  await trim(cache)
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('sa-') && ![STATIC_CACHE, PAGE_CACHE, SHELL_CACHE].includes(name)) await caches.delete(name)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const route = routeFor(event.request.url, event.request.mode, event.request.method)
  if (route === 'static') event.respondWith(staticFirst(event.request))
  else if (route === 'page') event.respondWith(pageNetworkFirst(event.request, event))
  // anything else: no respondWith, the browser handles it exactly as if this worker did not exist
})

self.addEventListener('message', (event) => {
  const d = event.data || {}
  if (d.type === 'cache-pages') event.waitUntil(savePages(d.urls))
  else if (d.type === 'clear') event.waitUntil(caches.delete(PAGE_CACHE))    // signing out: forget every saved page
})

// for the tests only
self.__offlineWorker = { routeFor, pageKey, pageNetworkFirst, staticFirst, savePages, saveAssetsFor, PAGE_CACHE, STATIC_CACHE, MAX_PAGES, MAX_ASSETS_PER_PAGE }
