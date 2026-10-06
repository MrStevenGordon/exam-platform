// Finds which Tabler icons the app uses, so the icon font can be cut down to just those (see scripts/build-icon-font.mjs).
// Used by the generator and by the build check (scripts/check-icons.mjs), so both agree on what "used" means.
//
// Two kinds of use are recognised:
//   * a whole name written out:        className="ti ti-home"       -> ti-home
//   * a name built in a template:      `ti ti-chevron-${open ? 'up' : 'down'}`  -> every icon starting "ti-chevron-"
// A name built with nothing fixed in front of the template (`ti-${name}`) cannot be cut down safely and is reported as a problem.

const NAME = '(?<![A-Za-z0-9_-])ti-[a-z0-9]+(?:-[a-z0-9]+)*'

export function scanSource(text) {
  const names = new Set()
  const prefixes = new Set()
  const bare = []
  for (const m of text.matchAll(new RegExp(`(${NAME}-)\\$\\{`, 'g'))) prefixes.add(m[1])
  for (const m of text.matchAll(new RegExp(`(?<![A-Za-z0-9_-])ti-\\$\\{`, 'g'))) bare.push(m[0])
  for (const m of text.matchAll(new RegExp(`(${NAME})(?![a-z0-9]|-\\$\\{)`, 'g'))) names.add(m[1])
  return { names, prefixes, bare }
}

export function mergeScans(scans) {
  const out = { names: new Set(), prefixes: new Set(), bare: [] }
  for (const s of scans) { s.names.forEach((n) => out.names.add(n)); s.prefixes.forEach((p) => out.prefixes.add(p)); out.bare.push(...s.bare) }
  return out
}

// "ti-home" -> codepoint, from tabler-icons.css:  .ti-home:before { content: "\eac1"; }
export function parseTablerCss(css) {
  const map = new Map()
  for (const m of css.matchAll(/\.(ti-[a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"/g)) map.set(m[1], parseInt(m[2], 16))
  return map
}

// The icons the font must contain: every real icon named, plus every icon under each template prefix.
export function neededIcons(scan, known) {
  const need = new Set()
  const notIcons = []
  for (const n of scan.names) { if (known.has(n)) need.add(n); else notIcons.push(n) }
  const emptyPrefixes = []
  for (const p of scan.prefixes) {
    let any = false
    for (const k of known.keys()) if (k.startsWith(p)) { need.add(k); any = true }
    if (!any) emptyPrefixes.push(p)
  }
  return { need: [...need].sort(), notIcons: notIcons.sort(), emptyPrefixes: emptyPrefixes.sort() }
}

// Class names present in a generated icon stylesheet.
export function namesInCss(css) {
  return new Set([...css.matchAll(/\.(ti-[a-z0-9-]+):before/g)].map((m) => m[1]))
}
