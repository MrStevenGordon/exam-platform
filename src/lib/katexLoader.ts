// Loads KaTeX (and its chemistry add-on) once, only when a page actually has math to show.
import type KatexType from 'katex'

type Katex = typeof KatexType
let cached: Katex | null = null
let pending: Promise<Katex> | null = null

export function katexIfLoaded(): Katex | null {
  return cached
}

export function loadKatex(): Promise<Katex> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = import('katex')
      .then(async (m) => {
        await import('katex/contrib/mhchem')
        cached = m.default
        return m.default
      })
      .catch((err) => { pending = null; throw err })
  }
  return pending
}

export function renderMathHtml(katex: Katex, latex: string, display: boolean): string {
  return katex.renderToString(latex, {
    throwOnError: false,
    displayMode: display,
    output: 'htmlAndMathml',
    strict: 'ignore',
    trust: false,
    maxSize: 30,
    maxExpand: 500,
  })
}
