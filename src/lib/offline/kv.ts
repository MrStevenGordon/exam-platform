import { openDB, type IDBPDatabase } from 'idb'

// A tiny key-value store, so the offline rules (offlineCache.ts) can be tested with a plain in-memory copy and run in the browser on
// IndexedDB. Every call degrades quietly: where IndexedDB is missing or blocked (a private window, a locked-down school device) the
// real store is simply null and the app works as it always did, online only.

export interface Kv {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  keys(prefix: string): Promise<string[]>
}

export function memoryKv(): Kv & { dump(): Record<string, unknown> } {
  const m = new Map<string, unknown>()
  const copy = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T))   // like a real store: what goes in is a copy
  return {
    async get<T>(key: string) { return copy(m.get(key) as T | undefined) },
    async put(key, value) { m.set(key, copy(value)) },
    async delete(key) { m.delete(key) },
    async keys(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)).sort() },
    dump() { return Object.fromEntries(m) },
  }
}

let dbPromise: Promise<IDBPDatabase> | null = null
let real: Kv | null | undefined

export function idbKv(): Kv | null {
  if (real !== undefined) return real
  if (typeof window === 'undefined' || !('indexedDB' in window)) { real = null; return real }
  const db = () => (dbPromise ??= openDB('smart-assess-offline', 1, { upgrade(d) { d.createObjectStore('kv') } }))
  real = {
    async get<T>(key: string) { try { return (await (await db()).get('kv', key)) as T | undefined } catch { return undefined } },
    async put(key, value) { try { await (await db()).put('kv', value, key) } catch { /* storage full or blocked: carry on online */ } },
    async delete(key) { try { await (await db()).delete('kv', key) } catch { /* ignore */ } },
    async keys(prefix) { try { return ((await (await db()).getAllKeys('kv', IDBKeyRange.bound(prefix, prefix + '￿'))) as string[]) } catch { return [] } },
  }
  return real
}
