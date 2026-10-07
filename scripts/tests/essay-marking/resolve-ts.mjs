// Lets Node run the app's TypeScript files in tests: relative imports in the source have no ".ts" ending, so add it when resolving,
// and the app's "@/..." shortcut (for the src folder) points at the real files.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const SRC = pathToFileURL(path.resolve('src')).href
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const target = ${JSON.stringify(SRC)} + '/' + specifier.slice(2)
    try { return await next(target + '.ts', context) } catch { /* fall through */ }
    try { return await next(target + '/index.ts', context) } catch { /* fall through */ }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-z]+$/.test(specifier)) {
    try { return await next(specifier + '.ts', context) } catch { /* fall through */ }
  }
  return next(specifier, context)
}`))
