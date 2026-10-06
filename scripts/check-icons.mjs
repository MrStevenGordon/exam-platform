// Build check: every icon the app uses must be in the cut-down icon font, otherwise it would silently show as blank.
// Runs before every build (npm run build) and on its own:  npm run icons:check
// If it fails, run  npm run icons:build  and commit the two files it writes.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { mergeScans, namesInCss, neededIcons, parseTablerCss, scanSource } from './lib/iconScan.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const OUT_CSS = join(ROOT, 'src/app/tabler-icons-subset.css')
const TABLER_CSS = join(ROOT, 'node_modules/@tabler/icons-webfont/dist/tabler-icons.css')

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'].includes(extname(p)) && p !== OUT_CSS) out.push(p)
  }
  return out
}

if (!existsSync(OUT_CSS)) { console.error('The cut-down icon font is missing. Run: npm run icons:build'); process.exit(1) }
if (!existsSync(TABLER_CSS)) { console.log('Icon check skipped (the Tabler package is not installed).'); process.exit(0) }

const scan = mergeScans(walk(join(ROOT, 'src')).map((f) => scanSource(readFileSync(f, 'utf8'))))
const { need } = neededIcons(scan, parseTablerCss(readFileSync(TABLER_CSS, 'utf8')))
const have = namesInCss(readFileSync(OUT_CSS, 'utf8'))
const missing = need.filter((n) => !have.has(n))
if (scan.bare.length) { console.error('An icon name is built from nothing fixed ("ti-${...}"), so the icon font cannot be cut safely.'); process.exit(1) }
if (missing.length) {
  console.error(`These icons are used but not in the cut-down icon font, so they would show blank:\n  ${missing.join('\n  ')}\nFix: npm run icons:build   (needs: python3 -m pip install fonttools brotli), then commit src/app/tabler-icons-subset.*`)
  process.exit(1)
}
console.log(`Icon check passed: all ${need.length} icons in use are in the icon font.`)
