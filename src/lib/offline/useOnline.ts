'use client'

import { useSyncExternalStore } from 'react'

// True while the browser believes it has a connection. (A connection that is up but useless is still caught: calls that then fail are
// treated as offline by the code that makes them, see isNetworkFailure.)
const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

// Screens that change what the banner should say tell it with this.
export const QUEUE_EVENT = 'smart-assess-offline-queue'
export const announceQueueChange = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT)) }
