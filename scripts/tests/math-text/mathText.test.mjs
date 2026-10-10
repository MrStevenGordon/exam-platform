// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/math-text/mathText.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitMathText, hasMath, wrapMath, insertAt, latexToLinear, toSpeech, toPlainText, stripPlaceholders } from '../../../src/lib/mathText.ts'

const kinds = (t) => splitMathText(t).map((s) => (s.kind === 'text' ? `T:${s.text}` : `${s.display ? 'D' : 'M'}:${s.latex}`))

test('plain text, money and empty input are left alone', () => {
  assert.deepEqual(kinds(''), []); assert.deepEqual(kinds(null), [])
  assert.deepEqual(kinds('Find 5 + 3'), ['T:Find 5 + 3'])
  assert.deepEqual(kinds('At what rate per year does $400 earn $48 simple interest in 3 years?'), ['T:At what rate per year does $400 earn $48 simple interest in 3 years?'])
  assert.deepEqual(kinds('Sam paid $5 and Ann paid $6.'), ['T:Sam paid $5 and Ann paid $6.'])
  assert.equal(hasMath('$2500 earns $200'), false)
})

test('the delimiters the Math button writes are read as math', () => {
  assert.deepEqual(kinds('Simplify \\(\\frac{1}{2} + x^2\\) now'), ['T:Simplify ', 'M:\\frac{1}{2} + x^2', 'T: now'])
  assert.deepEqual(kinds('Show \\[x^2\\] and $$y$$'), ['T:Show ', 'D:x^2', 'T: and ', 'D:y'])
})

test('older dollar style works only when the inside is clearly math', () => {
  assert.deepEqual(kinds('Solve $x^2 = 4$ please'), ['T:Solve ', 'M:x^2 = 4', 'T: please'])
  assert.deepEqual(kinds('Cost is $5^2$ dollars'), ['T:Cost is ', 'M:5^2', 'T: dollars'])
  assert.deepEqual(kinds('It costs $4 or $5'), ['T:It costs $4 or $5'])
  assert.equal(hasMath('$\\frac{1}{2}$'), true)
})

test('an escaped dollar is a dollar and an unfinished delimiter stays text', () => {
  assert.deepEqual(kinds('Price \\$5 and \\(x^2\\)'), ['T:Price $5 and ', 'M:x^2'])
  assert.deepEqual(kinds('Broken \\(x^2 never closes'), ['T:Broken \\(x^2 never closes'])
  assert.deepEqual(kinds('Empty \\(\\) here'), ['T:Empty \\(\\) here'])
})

test('very long text and huge numbers of equations are not worked through', () => {
  const long = 'a '.repeat(11000) + '\\(x^2\\)'
  assert.deepEqual(splitMathText(long), [{ kind: 'text', text: long }])
  const many = Array.from({ length: 300 }, () => '\\(x\\)').join(' ')
  assert.equal(splitMathText(many).filter((s) => s.kind === 'math').length, 200)
})

test('wrapMath and insertAt', () => {
  assert.equal(wrapMath(' \\frac{1}{2} '), '\\(\\frac{1}{2}\\)'); assert.equal(wrapMath('  '), '')
  assert.deepEqual(insertAt('Solve  now', 6, 6, '\\(x\\)'), { value: 'Solve \\(x\\) now', caret: 11 })
  assert.deepEqual(insertAt('Solve', null, null, '\\(x\\)'), { value: 'Solve \\(x\\)', caret: 11 })
  assert.deepEqual(insertAt('', 0, 0, '\\(x\\)'), { value: '\\(x\\)', caret: 5 })
  assert.deepEqual(insertAt('abc', 1, 3, '\\(x\\)'), { value: 'a \\(x\\)', caret: 7 })
})

test('typed answers come back as the plain text a teacher would type', () => {
  const cases = [
    ['\\frac{1}{2}', '1/2'], ['\\frac{x+1}{2}', '(x+1)/2'], ['x^{2}+3x', 'x^2+3x'], ['x^2', 'x^2'], ['\\sqrt{16}', 'sqrt(16)'],
    ['2\\times3', '2×3'], ['\\pi r^{2}', 'πr^2'], ['x^{n+1}', 'x^(n+1)'], ['\\left(x+1\\right)^2', '(x+1)^2'], ['90^\\circ', '90°'],
    ['\\dfrac{3}{4}', '3/4'], ['\\frac12+x^2', '1/2+x^2'], ['\\frac1{2}', '1/2'], ['\\frac{1}2', '1/2'], ['\\sqrt2', 'sqrt(2)'], ['\\frac\\pi2', 'π/2'], ['a_{1}', 'a_1'], ['\\frac{\\frac{1}{2}}{3}', '(1/2)/3'], ['\\text{cm}^2', 'cm^2'], ['50\\%', '50%'], ['', ''],
  ]
  for (const [latex, expected] of cases) assert.equal(latexToLinear(latex), expected, latex)
  assert.equal(latexToLinear(null), '')
})

test('equations are read aloud in words', () => {
  assert.equal(toSpeech('Find \\(x^2 + 3\\)'), 'Find x squared plus 3')
  assert.equal(toSpeech('\\(\\frac{1}{2}\\)'), '1 over 2')
  assert.equal(toSpeech('\\(\\sqrt{16} = 4\\)'), 'square root of 16 equals 4')
  assert.equal(toSpeech('\\(x^{n}\\)'), 'x to the power n')
  assert.equal(toSpeech('It costs $400 today'), 'It costs $400 today')
  assert.equal(toSpeech('\\(\\pi r^3\\)'), 'pi r cubed')
})

test('empty slots left by the math box are removed', () => {
  assert.equal(stripPlaceholders('\\frac{2}{\\placeholder{}}'), '\\frac{2}{}')
  assert.equal(wrapMath('\\placeholder{}'), '')
  assert.equal(latexToLinear('x+\\placeholder[a]{}'), 'x+')
})

test('plain text version for lists and titles', () => {
  assert.equal(toPlainText('Find \\(\\frac{1}{2}\\) of $400'), 'Find 1/2 of $400')
  assert.equal(toPlainText('\\(x^2\\)'), 'x^2')
})

test('shorthand without braces is spoken too', () => {
  assert.equal(toSpeech('\\(\\frac12\\)'), '1 over 2')
  assert.equal(toSpeech('\\(\\sqrt9\\)'), 'square root of 9')
})
