// Math in question text: how it is marked up, split for display, spoken, and turned into plain text for typed answers.
// Pure functions only, so they are easy to test and safe to use on the server or in the browser.
//
// Markup (a teacher never has to type it; the Math button writes it):
//   \( ... \)     inline math
//   \[ ... \]     math on its own line
//   $$ ... $$    math on its own line
//   $ ... $      older style, honoured ONLY when the inside looks like math (has \ ^ _ or {), so "$400 earns $48" stays money.
//   \$           a literal dollar sign

export type MathSegment = { kind: 'text'; text: string } | { kind: 'math'; latex: string; display: boolean }

const MAX_LENGTH = 20000
const MAX_MATH_SEGMENTS = 200

function looksLikeMath(inner: string): boolean {
  if (!inner || inner !== inner.trim()) return false
  return /[\\^_{]/.test(inner)
}

export function splitMathText(input: string | null | undefined): MathSegment[] {
  const text = input ?? ''
  if (text.length === 0) return []
  if (text.length > MAX_LENGTH || !/[$\\]/.test(text)) return [{ kind: 'text', text }]

  const out: MathSegment[] = []
  let buf = ''
  let mathCount = 0
  const flush = () => { if (buf) { out.push({ kind: 'text', text: buf }); buf = '' } }
  const take = (latex: string, display: boolean) => { flush(); out.push({ kind: 'math', latex, display }); mathCount++ }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    if (rest.startsWith('\\$')) { buf += '$'; i += 2; continue }
    if (mathCount < MAX_MATH_SEGMENTS) {
      if (rest.startsWith('\\(')) {
        const end = text.indexOf('\\)', i + 2)
        if (end > i + 2) { take(text.slice(i + 2, end).trim(), false); i = end + 2; continue }
      } else if (rest.startsWith('\\[')) {
        const end = text.indexOf('\\]', i + 2)
        if (end > i + 2) { take(text.slice(i + 2, end).trim(), true); i = end + 2; continue }
      } else if (rest.startsWith('$$')) {
        const end = text.indexOf('$$', i + 2)
        if (end > i + 2) { take(text.slice(i + 2, end).trim(), true); i = end + 2; continue }
      } else if (rest[0] === '$') {
        const end = text.indexOf('$', i + 1)
        if (end > i + 1 && looksLikeMath(text.slice(i + 1, end))) { take(text.slice(i + 1, end), false); i = end + 1; continue }
      }
    }
    buf += text[i]
    i++
  }
  flush()
  return out
}

export function hasMath(text: string | null | undefined): boolean {
  return splitMathText(text).some((s) => s.kind === 'math')
}

// What the Math button writes into a question, an option or an explanation.
export function wrapMath(latex: string): string {
  const t = stripPlaceholders(latex).trim()
  return t ? `\\(${t}\\)` : ''
}

// MathLive writes \placeholder{} for an empty slot (a fraction with no bottom yet); it is not math a student should see.
export function stripPlaceholders(latex: string): string {
  return latex.replace(/\\placeholder(\[[^\]]*\])?\{[^{}]*\}/g, '')
}

// Put `insert` where the cursor (or selection) is. Used for plain text boxes.
export function insertAt(value: string, start: number | null | undefined, end: number | null | undefined, insert: string): { value: string; caret: number } {
  const s = Math.max(0, Math.min(start ?? value.length, value.length))
  const e = Math.max(s, Math.min(end ?? s, value.length))
  const before = value.slice(0, s)
  const after = value.slice(e)
  const pad = before && !/\s$/.test(before) ? ' ' : ''
  const next = `${before}${pad}${insert}${after}`
  return { value: next, caret: before.length + pad.length + insert.length }
}

// ---- Typed answers: LaTeX -> plain text ------------------------------------------------------------------------------
// Short and fill-in answers are marked by comparing text, so a math box has to give back the same plain text a teacher would
// type as the correct answer (1/2, x^2+3x, sqrt(16)). The result has no spaces.

const SYMBOLS: Record<string, string> = {
  pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', sigma: 'σ', omega: 'ω', phi: 'φ',
  infty: '∞', pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷', neq: '≠', ne: '≠', leq: '<=', le: '<=', geq: '>=', ge: '>=',
  approx: '≈', degree: '°', circ: '°', to: '->', rightarrow: '->', Delta: 'Δ', Omega: 'Ω', Sigma: 'Σ', Pi: 'Π',
}

function readGroup(s: string, i: number): { text: string; next: number } | null {
  if (s[i] !== '{') return null
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++
    else if (s[j] === '}') { depth--; if (depth === 0) return { text: s.slice(i + 1, j), next: j + 1 } }
  }
  return null
}

// An argument written with or without braces: \frac{1}{2}, \frac12 and \frac1{2} all mean the same thing.
function readArg(s: string, i: number): { text: string; next: number } | null {
  let j = i
  while (s[j] === ' ') j++
  const g = readGroup(s, j)
  if (g) return g
  if (j >= s.length) return null
  if (s[j] === '\\') {
    const m = /^\\([A-Za-z]+|.)/.exec(s.slice(j))
    return m ? { text: m[0], next: j + m[0].length } : null
  }
  if (s[j] === '}' || s[j] === '{') return null
  return { text: s[j], next: j + 1 }
}

const isSimple = (t: string) => /^[A-Za-z0-9.π°]+$/.test(t)
const paren = (t: string) => (isSimple(t) ? t : `(${t})`)

function convert(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i))
      if (!m) { i++; continue }
      const name = m[1]
      i += m[0].length
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const a = readArg(s, i)
        if (a) {
          const b = readArg(s, a.next)
          if (b) { out += `${paren(convert(a.text))}/${paren(convert(b.text))}`; i = b.next; continue }
        }
        continue
      }
      if (name === 'sqrt') {
        let root = ''
        if (s[i] === '[') { const close = s.indexOf(']', i); if (close > i) { root = convert(s.slice(i + 1, close)); i = close + 1 } }
        const g = readArg(s, i)
        if (g) { out += root ? `root${root}(${convert(g.text)})` : `sqrt(${convert(g.text)})`; i = g.next; continue }
        continue
      }
      if (name === 'left' || name === 'right' || name === 'displaystyle' || name === 'textstyle') { if (s[i] === '.') i++; continue }
      if (name === 'text' || name === 'mathrm' || name === 'mathbf' || name === 'textbf' || name === 'operatorname') {
        const g = readGroup(s, i)
        if (g) { out += g.text; i = g.next; continue }
        continue
      }
      if (name === 'ce') { const g = readGroup(s, i); if (g) { out += g.text.replace(/\s+/g, ''); i = g.next } continue }
      if (name === ',' || name === ';' || name === ':' || name === '!' || name === ' ' || name === 'quad' || name === 'qquad') continue
      if (name === '%') { out += '%'; continue }
      if (name === '{' || name === '}') { out += name; continue }
      if (name === 'sin' || name === 'cos' || name === 'tan' || name === 'log' || name === 'ln') { out += name; continue }
      if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) { out += SYMBOLS[name]; continue }
      out += name
      continue
    }
    if (c === '^' || c === '_') {
      i++
      const g = readGroup(s, i)
      if (g) {
        const inner = convert(g.text)
        out += `${c}${paren(inner)}`
        i = g.next
      } else if (s[i] === '\\') {
        const m = /^\\([A-Za-z]+)/.exec(s.slice(i))
        const piece = m ? convert(m[0]) : ''
        out += `${c}${piece}`
        i += m ? m[0].length : 1
      } else if (i < s.length) {
        out += `${c}${s[i]}`
        i++
      }
      continue
    }
    if (c === '{' || c === '}') { i++; continue }
    if (/\s/.test(c)) { i++; continue }
    out += c
    i++
  }
  return out
}

export function latexToLinear(latex: string | null | undefined): string {
  if (!latex) return ''
  return convert(stripPlaceholders(latex)).replace(/\^°/g, '°')
}

// ---- Read aloud ------------------------------------------------------------------------------------------------------

const SPOKEN: Record<string, string> = {
  pi: 'pi', theta: 'theta', alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', times: 'times', cdot: 'times', div: 'divided by',
  pm: 'plus or minus', neq: 'is not equal to', ne: 'is not equal to', leq: 'is less than or equal to', le: 'is less than or equal to',
  geq: 'is greater than or equal to', ge: 'is greater than or equal to', infty: 'infinity', degree: 'degrees', circ: 'degrees', approx: 'is approximately',
  sin: 'sine', cos: 'cosine', tan: 'tangent', log: 'log', ln: 'natural log',
}

function speakMath(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i))
      if (!m) { i++; continue }
      const name = m[1]
      i += m[0].length
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const a = readArg(s, i)
        const b = a ? readArg(s, a.next) : null
        if (a && b) { out += ` ${speakMath(a.text)} over ${speakMath(b.text)} `; i = b.next }
        continue
      }
      if (name === 'sqrt') {
        const g = readArg(s, i)
        if (g) { out += ` square root of ${speakMath(g.text)} `; i = g.next }
        continue
      }
      if (name === 'ce') { const g = readGroup(s, i); if (g) { out += ` ${g.text.replace(/([A-Za-z])/g, ' $1').replace(/(\d+)/g, ' $1 ')} `; i = g.next } continue }
      if (name === 'left' || name === 'right') continue
      if (name === 'text' || name === 'mathrm') { const g = readGroup(s, i); if (g) { out += ` ${g.text} `; i = g.next } continue }
      if (Object.prototype.hasOwnProperty.call(SPOKEN, name)) { out += ` ${SPOKEN[name]} `; continue }
      out += ` ${name} `
      continue
    }
    if (c === '^') {
      i++
      const g = readGroup(s, i)
      const exp = g ? g.text : s[i] ?? ''
      i = g ? g.next : i + 1
      out += exp === '2' ? ' squared ' : exp === '3' ? ' cubed ' : ` to the power ${speakMath(exp)} `
      continue
    }
    if (c === '_') {
      i++
      const g = readGroup(s, i)
      out += ` sub ${speakMath(g ? g.text : s[i] ?? '')} `
      i = g ? g.next : i + 1
      continue
    }
    if (c === '+') { out += ' plus '; i++; continue }
    if (c === '-' || c === '−') { out += ' minus '; i++; continue }
    if (c === '=') { out += ' equals '; i++; continue }
    if (c === '<') { out += ' is less than '; i++; continue }
    if (c === '>') { out += ' is greater than '; i++; continue }
    if (c === '/') { out += ' over '; i++; continue }
    if (c === '%') { out += ' percent '; i++; continue }
    if (c === '{' || c === '}') { i++; continue }
    out += c
    i++
  }
  return out.replace(/\s+/g, ' ').trim()
}

// The text a read-aloud button should say for a question or option that may contain math.
export function toSpeech(text: string | null | undefined): string {
  return splitMathText(text)
    .map((seg) => (seg.kind === 'text' ? seg.text : ` ${speakMath(seg.latex)} `))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

// Text with its math written as plain symbols, for places that cannot show typeset math (a select list, a title).
export function toPlainText(text: string | null | undefined): string {
  return splitMathText(text)
    .map((seg) => (seg.kind === 'text' ? seg.text : latexToLinear(seg.latex)))
    .join('')
}
