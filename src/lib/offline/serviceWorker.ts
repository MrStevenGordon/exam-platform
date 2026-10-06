// Talking to the offline service worker (public/sw.js). It is only used where a service worker exists (a production build in a browser
// that supports them); everywhere else every function here quietly does nothing and the app works as it always did.

const SW_URL = '/sw.js'
const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production'

export async function registerOfflineWorker(): Promise<void> {
  if (!supported()) return
  try { await navigator.serviceWorker.register(SW_URL, { scope: '/' }) } catch { /* the app works without it */ }
}

async function post(message: Record<string, unknown>): Promise<void> {
  if (!supported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage(message)
  } catch { /* ignore */ }
}

// Asks the worker to keep a copy of these pages, so they open without a connection later. Call it only while online and signed in.
export const warmOfflinePages = (urls: string[]): void => { void post({ type: 'cache-pages', urls }) }

// Signing out: forget every saved page and file.
export const clearOfflineWorkerCaches = (): Promise<void> => post({ type: 'clear' })
