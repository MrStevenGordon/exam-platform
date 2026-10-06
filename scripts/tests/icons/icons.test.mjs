// Run: node --test scripts/tests/icons/icons.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { scanSource, mergeScans, neededIcons, parseTablerCss, namesInCss } from '../../lib/iconScan.mjs'

test('whole icon names are found, in classes, strings and objects', () => {
  const s = scanSource(`<i className="ti ti-home" /> const nav = [{ icon: 'ti-chart-line' }, { icon: "ti-users" }]`)
  assert.deepEqual([...s.names].sort(), ['ti-chart-line', 'ti-home', 'ti-users'])
  assert.equal(s.prefixes.size, 0)
})

test('a name built in a template is a prefix, and its start is not mistaken for a whole name', () => {
  const s = scanSource("<i className={`ti ti-chevron-${open ? 'up' : 'down'}`} />")
  assert.deepEqual([...s.prefixes], ['ti-chevron-'])
  assert.equal(s.names.has('ti-chevron'), false)
  assert.equal(s.bare.length, 0)
})

test('a name built from nothing fixed is reported, because the font cannot be cut for it', () => {
  assert.equal(scanSource('`ti-${name}`').bare.length, 1)
})

test('words that merely contain "ti-" are not icons', () => {
  const s = scanSource('const x = "multi-select"; // anti-pattern, mati-ko, "not ti-"')
  assert.equal(s.names.has('ti-select'), false); assert.equal(s.names.has('ti-pattern'), false); assert.equal(s.names.has('ti-ko'), false)
})

const FAKE_CSS = '.ti-home:before { content: "\\eac1"; }\n.ti-chevron-up:before { content: "\\ea62"; }\n.ti-chevron-down:before { content: "\\ea5f"; }\n.ti-chevron-left:before{content:"\\ea60"}\n.ti-users:before { content: "\\ebf2" }'
test('the stylesheet is read, whole names and prefixes are expanded, and non-icons are set aside', () => {
  const known = parseTablerCss(FAKE_CSS)
  assert.equal(known.get('ti-home'), 0xeac1); assert.equal(known.size, 5)
  const scan = mergeScans([scanSource('ti-home ti-nothing'), scanSource('ti-chevron-${d}')])
  const r = neededIcons(scan, known)
  assert.deepEqual(r.need, ['ti-chevron-down', 'ti-chevron-left', 'ti-chevron-up', 'ti-home'])
  assert.deepEqual(r.notIcons, ['ti-nothing'])
  assert.deepEqual(neededIcons(scanSource('ti-zzz-${x}'), known).emptyPrefixes, ['ti-zzz-'])
})

test('names in a generated stylesheet are read back', () => {
  assert.deepEqual([...namesInCss('.ti-a:before { content: "\\e1"; }\n.ti-b-c:before { content: "\\e2"; }')].sort(), ['ti-a', 'ti-b-c'])
})

// The real project: every icon the app uses must be in the committed cut-down font, or it would show blank.
const ROOT = resolve(import.meta.dirname, '../../..')
const GENERATED = join(ROOT, 'src/app/tabler-icons-subset.css')
const TABLER = join(ROOT, 'node_modules/@tabler/icons-webfont/dist/tabler-icons.css')
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'].includes(extname(p)) && p !== GENERATED) out.push(p)
  }
  return out
}
test('every icon the app uses is in the cut-down icon font', { skip: !existsSync(TABLER) || !existsSync(GENERATED) }, () => {
  const scan = mergeScans(walk(join(ROOT, 'src')).map((f) => scanSource(readFileSync(f, 'utf8'))))
  assert.equal(scan.bare.length, 0)
  const { need } = neededIcons(scan, parseTablerCss(readFileSync(TABLER, 'utf8')))
  const have = namesInCss(readFileSync(GENERATED, 'utf8'))
  assert.deepEqual(need.filter((n) => !have.has(n)), [])
  assert.ok(need.length > 80)
})
