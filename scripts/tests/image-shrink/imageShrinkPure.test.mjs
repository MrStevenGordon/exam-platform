// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/image-shrink/imageShrinkPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planShrink, useShrunk, withWebpName, QUESTION_PICTURE, LOGO_PICTURE } from '../../../src/lib/imageShrinkPure.ts'

const MB = 1024 * 1024
test('a big phone photo is cut to 1600 on its longest side, keeping its shape', () => {
  const p = planShrink({ type: 'image/jpeg', size: 5 * MB, width: 4032, height: 3024 }, QUESTION_PICTURE)
  assert.deepEqual(p, { shrink: true, width: 1600, height: 1200, mime: 'image/webp', quality: 0.82 })
  const tall = planShrink({ type: 'image/jpeg', size: 5 * MB, width: 3024, height: 4032 }, QUESTION_PICTURE)
  assert.equal(tall.width, 1200); assert.equal(tall.height, 1600)
})
test('a small, light picture is left alone', () => {
  assert.deepEqual(planShrink({ type: 'image/png', size: 50 * 1024, width: 800, height: 600 }, QUESTION_PICTURE), { shrink: false, reason: 'already_small' })
})
test('a picture that fits on screen but is heavy is still recompressed, without being made bigger', () => {
  const p = planShrink({ type: 'image/png', size: 3 * MB, width: 1200, height: 900 }, QUESTION_PICTURE)
  assert.equal(p.shrink, true); assert.equal(p.width, 1200); assert.equal(p.height, 900)
})
test('a large picture is never enlarged and sizes are whole numbers of at least 1', () => {
  const p = planShrink({ type: 'image/jpeg', size: 5 * MB, width: 5000, height: 7 }, QUESTION_PICTURE)
  assert.equal(p.shrink, true); assert.equal(p.width, 1600); assert.equal(p.height, 2)
  assert.equal(planShrink({ type: 'image/jpeg', size: 5 * MB, width: 1000000, height: 1 }, QUESTION_PICTURE).height, 1)
})
test('animated and vector pictures and non-pictures are never redrawn', () => {
  assert.equal(planShrink({ type: 'image/gif', size: 9 * MB, width: 4000, height: 4000 }, QUESTION_PICTURE).reason, 'animated_or_vector')
  assert.equal(planShrink({ type: 'image/svg+xml', size: 9 * MB, width: 4000, height: 4000 }, QUESTION_PICTURE).reason, 'animated_or_vector')
  assert.equal(planShrink({ type: 'application/pdf', size: 9 * MB, width: 100, height: 100 }, QUESTION_PICTURE).reason, 'not_a_picture')
  assert.equal(planShrink({ type: '', size: 9 * MB, width: 100, height: 100 }, QUESTION_PICTURE).reason, 'not_a_picture')
})
test('broken sizes are left alone', () => {
  for (const bad of [{ width: 0, height: 10, size: 1 }, { width: 10, height: NaN, size: 1 }, { width: 10, height: 10, size: 0 }]) {
    assert.equal(planShrink({ type: 'image/jpeg', ...bad }, QUESTION_PICTURE).reason, 'bad_size')
  }
})
test('the logo is held to 600 and a small logo is left alone', () => {
  assert.equal(planShrink({ type: 'image/png', size: 900 * 1024, width: 2000, height: 1000 }, LOGO_PICTURE).width, 600)
  assert.equal(planShrink({ type: 'image/png', size: 20 * 1024, width: 400, height: 100 }, LOGO_PICTURE).reason, 'already_small')
})
test('the shrunk file is used only if it is smaller and really webp', () => {
  const plan = planShrink({ type: 'image/jpeg', size: 5 * MB, width: 4032, height: 3024 }, QUESTION_PICTURE)
  assert.equal(useShrunk({ size: 5 * MB }, { size: 200000, type: 'image/webp' }, plan), true)
  assert.equal(useShrunk({ size: 5 * MB }, { size: 200000, type: 'image/png' }, plan), false)   // an older browser quietly gave a PNG
  assert.equal(useShrunk({ size: 100000 }, { size: 150000, type: 'image/webp' }, plan), false)   // would have grown
  assert.equal(useShrunk({ size: 100000 }, null, plan), false)
  assert.equal(useShrunk({ size: 100000 }, { size: 0, type: 'image/webp' }, plan), false)
})
test('the file name keeps its name and takes the .webp ending', () => {
  assert.equal(withWebpName('IMG_1234.JPG'), 'IMG_1234.webp'); assert.equal(withWebpName('my.photo.of.cells.png'), 'my.photo.of.cells.webp')
  assert.equal(withWebpName('noextension'), 'noextension.webp'); assert.equal(withWebpName('.png'), 'picture.webp')
})
