import test from 'node:test'
import assert from 'node:assert/strict'
import { totp, base32Decode } from '../lib/totp.mjs'

test('RFC 6238 test vectors (SHA-1, 8 digits)', () => {
  const secret = '12345678901234567890'
  assert.equal(totp(secret, { time: 59 * 1000, digits: 8, raw: true }), '94287082')
  assert.equal(totp(secret, { time: 1111111109 * 1000, digits: 8, raw: true }), '07081804')
  assert.equal(totp(secret, { time: 1234567890 * 1000, digits: 8, raw: true }), '89005924')
})
test('a base32 secret gives the same code as the raw bytes', () => {
  assert.equal(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString(), '12345678901234567890')
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', { time: 59 * 1000, digits: 8 }), '94287082')
})
test('six digits, zero padded', () => assert.match(totp('GEZDGNBVGY3TQOJQ', { time: 0 }), /^\d{6}$/))
