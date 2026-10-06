// Lets Node run the app's TypeScript files in tests: relative imports in the source have no ".ts" ending, so add it when resolving.
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-z]+$/.test(specifier)) {
    try { return await next(specifier + '.ts', context) } catch { /* fall through */ }
  }
  return next(specifier, context)
}`))
