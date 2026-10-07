// A random id that also works on a page opened over plain http (for example the dev server on another laptop on the same Wi-Fi).
// crypto.randomUUID() exists only on secure pages (https or localhost); crypto.getRandomValues() works everywhere.
export function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40   // version 4
  b[8] = (b[8] & 0x3f) | 0x80   // variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
