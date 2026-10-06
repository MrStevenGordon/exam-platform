// Reads a JSON answer from the AI without being thrown by the usual small slips: a code fence round it, a sentence before or
// after it, a raw line break inside a text value (the commonest one when a field holds a list), a stray tab, or a comma left
// before a closing bracket. It cannot rescue a reply that was cut off part way (the AI ran out of room): that is reported as
// "truncated" so the caller can ask again with more room instead of showing a vague error.

export type AiJsonResult =
  | { ok: true; value: unknown; repaired: boolean }
  | { ok: false; reason: 'empty' | 'truncated' | 'invalid'; detail: string }

export function parseAiJson(text: string | null | undefined, opts: { stopReason?: string } = {}): AiJsonResult {
  const raw = String(text ?? '').replace(/```(?:json)?/gi, '').trim()
  if (!raw) return { ok: false, reason: 'empty', detail: 'The reply was empty.' }
  const start = raw.search(/[{[]/)
  if (start < 0) return { ok: false, reason: 'invalid', detail: 'The reply had no JSON in it.' }

  // Straight parse first: most replies are fine, and a clean reply should never be altered.
  const candidate = raw.slice(start)
  try { return { ok: true, value: JSON.parse(candidate), repaired: false } } catch { /* try to repair below */ }

  let out = ''
  let inString = false
  let escaped = false
  const stack: string[] = []
  let end = candidate.length
  for (let i = 0; i < candidate.length; i++) {
    const c = candidate[i]
    if (inString) {
      if (escaped) { out += c; escaped = false; continue }
      if (c === '\\') { out += c; escaped = true; continue }
      if (c === '"') { out += c; inString = false; continue }
      if (c === '\n') { out += '\\n'; continue }
      if (c === '\r') continue
      if (c === '\t') { out += '\\t'; continue }
      if (c < ' ') continue
      out += c
      continue
    }
    if (c === '"') { inString = true; out += c; continue }
    if (c === '{' || c === '[') { stack.push(c === '{' ? '}' : ']'); out += c; continue }
    if (c === '}' || c === ']') {
      out = out.replace(/,\s*$/, '')               // a comma left before a closing bracket
      stack.pop(); out += c
      if (stack.length === 0) { end = i + 1; break }  // the answer is complete; ignore anything after it
      continue
    }
    out += c
  }

  if (stack.length > 0 || inString || opts.stopReason === 'max_tokens') {
    return { ok: false, reason: 'truncated', detail: 'The reply stopped before the JSON was finished (the AI ran out of room).' }
  }
  try { return { ok: true, value: JSON.parse(out), repaired: true } } catch (e) {
    return { ok: false, reason: 'invalid', detail: `${e instanceof Error ? e.message : 'The JSON could not be read.'} (at ${end} characters)` }
  }
}
