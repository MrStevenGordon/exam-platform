// Tries the study guide drafting for real, against a lesson in the test school, and prints what the AI made so a person can judge it.
// Spends a few cents. Saves nothing. Needs a working ANTHROPIC_API_KEY (npm run check:ai first).
//   node --env-file-if-exists=.env.local --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings scripts/tests/lesson-guides/live-try.mjs [lessonId]
import { createClient } from '@supabase/supabase-js'
import { callClaude, AI_MODEL } from '../../../src/lib/ai.ts'
import { buildGuidePrompt, parseGuide, lessonSourceText } from '../../../src/lib/lessonGuide.ts'

const key = process.env.ANTHROPIC_API_KEY
if (!key) { console.error('No ANTHROPIC_API_KEY. Put it in .env.local.'); process.exit(2) }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const id = process.argv[2] || 'dd000000-0000-4000-8000-000000007002'
const { data: l, error } = await admin.from('learning_lessons').select('title, subject, grade, key_terms, steps').eq('id', id).single()
if (error || !l) { console.error('Lesson not found:', error?.message); process.exit(2) }

const input = { subject: l.subject, grade: l.grade, title: l.title, keyTerms: l.key_terms, steps: l.steps.map((s) => ({ key: s.key, text: s.text })) }
const t0 = Date.now()
const r = await callClaude(buildGuidePrompt(input), { maxTokens: 5000, apiKey: key, timeoutMs: 90000 })
if (!r.ok) { console.error(`AI failed [${r.kind}] ${r.message}`); process.exit(1) }
console.log(`Model ${AI_MODEL}, ${((Date.now() - t0) / 1000).toFixed(1)} s, stop reason: ${r.stopReason ?? 'n/a'}\n`)
const p = parseGuide(r.text, lessonSourceText(input), { stopReason: r.stopReason })
if (!p.ok) { console.error('Could not use the reply:', p.reason, '\n', r.text.slice(0, 600)); process.exit(1) }
const d = p.draft
console.log('KEY POINTS'); d.keyPoints.forEach((t) => console.log('  -', t))
console.log('\nI CAN'); d.canDo.forEach((t) => console.log('  -', t))
console.log(`\nCARDS (${d.cards.length})`); d.cards.forEach((c) => console.log(`  ${c.check ? '[CHECK] ' : ''}${c.front}  =>  ${c.back}   (${c.step ?? 'no step'})`))
console.log(`\nQUESTIONS (${d.questions.length})`)
d.questions.forEach((q) => { console.log(`  [${q.level}]${q.check ? ' [CHECK]' : ''} ${q.prompt}`); q.options.forEach((o, i) => console.log(`      ${i === q.correctIndex ? '*' : ' '} ${'ABCDEF'[i]}. ${o}`)); console.log(`      why: ${q.explanation}`) })
console.log(`\nLeft out: ${d.dropped}. Web addresses removed: ${d.removedLinks}. Items marked for checking: ${d.cards.filter((c) => c.check).length + d.questions.filter((q) => q.check).length}.`)
