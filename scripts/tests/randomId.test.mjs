import test from 'node:test'
import assert from 'node:assert/strict'
import { randomId } from '../../src/lib/randomId.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
test('a normal page gives a version 4 id', () => { assert.match(randomId(), UUID); assert.notEqual(randomId(), randomId()) })
test('a page without crypto.randomUUID (plain http) still gets a valid, different id', () => {
  const real = globalThis.crypto
  Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: real.getRandomValues.bind(real) }, configurable: true })
  try { const a = randomId(), b = randomId(); assert.match(a, UUID); assert.match(b, UUID); assert.notEqual(a, b) }
  finally { Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true }) }
})
test('even with no crypto at all it returns a valid id', () => {
  const real = globalThis.crypto
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
  try { assert.match(randomId(), UUID) } finally { Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true }) }
})
