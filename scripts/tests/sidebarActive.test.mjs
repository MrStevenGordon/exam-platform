import test from 'node:test'
import assert from 'node:assert/strict'
import { activeNavHref } from '../../src/lib/sidebarActive.ts'

const TEACHER = ['/teacher', '/teacher/tasks', '/teacher/tests', '/teacher/classes', '/teacher/report-cards']
const LEARN = ['/learning', '/learning/lessons/new', '/learning/lesson-plans', '/learning/report-absence', '/learning/cover', '/learning/week']
test('a page that is a menu item lights that item', () => { assert.equal(activeNavHref(TEACHER, '/teacher/tests'), '/teacher/tests'); assert.equal(activeNavHref(LEARN, '/learning/lesson-plans'), '/learning/lesson-plans') })
test('the home item lights only on its own page', () => { assert.equal(activeNavHref(TEACHER, '/teacher'), '/teacher'); assert.equal(activeNavHref(TEACHER, '/teacher/report-absence'), null); assert.equal(activeNavHref(LEARN, '/learning/something-new'), null) })
test('a page under a menu item lights that item (the longest match wins)', () => {
  assert.equal(activeNavHref(TEACHER, '/teacher/tests/archive'), '/teacher/tests')
  assert.equal(activeNavHref(['/x', '/x/a', '/x/a/b'], '/x/a/b/c'), '/x/a/b')
})
test('a look-alike address does not match ("/teacher/tests-old" is not under "/teacher/tests")', () => assert.equal(activeNavHref(TEACHER, '/teacher/tests-old'), null))
test('nothing lit without an address', () => { assert.equal(activeNavHref(TEACHER, null), null); assert.equal(activeNavHref(TEACHER, undefined), null) })
