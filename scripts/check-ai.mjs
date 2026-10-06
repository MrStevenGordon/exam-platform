// Health check for the AI connection: is the key accepted, is there credit, and does every model the app uses still answer?
// It sends one tiny question per model (a few cents at most). Run it before a release, or any time a teacher reports an AI error:
//   npm run check:ai                       (uses ANTHROPIC_API_KEY from .env.local)
//   ANTHROPIC_API_KEY=sk-ant-... npm run check:ai   (to test the key that is on Vercel)
import { callClaude, AI_MODEL, AI_USER_MESSAGES } from '../src/lib/ai.ts'

const key = process.env.ANTHROPIC_API_KEY
if (!key) { console.error('No ANTHROPIC_API_KEY found. Put it in .env.local or pass it on the command line.'); process.exit(2) }

// Every model name the app uses. Keep this in step with the routes (grep for "model:" under src/app/api and src/lib).
const MODELS = [...new Set([AI_MODEL, 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'])]
let bad = 0
for (const model of MODELS) {
  const r = await callClaude('Reply with the single word: ready', { maxTokens: 200, apiKey: key, model, timeoutMs: 30000 })
  if (r.ok) console.log(`OK    ${model}`)
  else { bad++; console.log(`FAIL  ${model}  [${r.kind}] ${AI_USER_MESSAGES[r.kind]}  (HTTP ${r.status}: ${r.message.slice(0, 120)})`) }
}
console.log(bad ? `\n${bad} of ${MODELS.length} models failed.` : '\nAll good.')
process.exit(bad ? 1 : 0)
