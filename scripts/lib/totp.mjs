// A small TOTP (RFC 6238) generator, used only to sign in to the TEST school's accounts during QA. Staff accounts need an authenticator code; the test
// accounts' secrets are kept in .qa-totp.json (git-ignored) so a code can be produced on demand.
import { createHmac } from 'node:crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32Decode(s) {
  const clean = s.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase()
  let bits = 0, value = 0
  const out = []
  for (const ch of clean) {
    const i = B32.indexOf(ch)
    if (i < 0) throw new Error('Not a base32 secret')
    value = (value << 5) | i; bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

export function totp(secret, { time = Date.now(), step = 30, digits = 6, raw = false } = {}) {
  const key = raw ? Buffer.from(secret) : base32Decode(secret)
  const counter = Math.floor(time / 1000 / step)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', key).update(buf).digest()
  const off = h[h.length - 1] & 0xf
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}
