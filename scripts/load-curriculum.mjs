// Loads a national curriculum guide (a PDF) into the central curriculum search, so the AI lesson planner can draw on it.
//
// Dry run first (changes nothing, shows what it found):
//   node scripts/load-curriculum.mjs --file ~/Downloads/Civics.pdf --subject "Civics" --grades 7-9 --env .env.local
// Then load it:
//   node scripts/load-curriculum.mjs --file ... --subject "Civics" --grades 7-9 --env .env.local --apply --project <central project ref>
//
// Options
//   --subject   the subject as teachers name it, for example "English Language" or "Mathematics"
//   --grades    "7-9" or "8"
//   --aliases   other names for the subject, comma separated, for example "English,Literature"
//   --title     defaults to "National Standards Curriculum Guide: <subject>, Grades <grades>"
//   --year      year published, if the guide says
//   --publisher defaults to the Ministry of Education
//   --licence   a note about the right to use it
//   --replace   remove the same file if it was loaded before, then load it again
//   --emit-sql  write the rows as SQL to this file instead of sending them (for testing on a throwaway database)
// The env file needs LIBRARY_SUPABASE_URL and LIBRARY_SUPABASE_SECRET_KEY (the central project). --project must match the project ref
// in that URL so the wrong database can never be changed by accident. Needs `pdftotext` (poppler) installed.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { buildChunks, parseGrades } from './lib/curriculumChunks.mjs'

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null }
const has = (name) => args.includes(name)
const fail = (m) => { console.error(m); process.exit(1) }

const file = opt('--file'), subject = opt('--subject'), gradesText = opt('--grades')
if (!file || !subject || !gradesText) fail('Usage: node scripts/load-curriculum.mjs --file <pdf> --subject "<subject>" --grades 7-9 [--aliases "a,b"] [--env .env.local] [--apply --project <ref>]')
const abs = path.resolve(file.replace(/^~/, process.env.HOME || '~'))
if (!fs.existsSync(abs)) fail(`File not found: ${abs}`)
const grades = parseGrades(gradesText)
if (!grades) fail(`"${gradesText}" is not a grade or range from 7 to 13 (for example 7-9)`)
const aliases = (opt('--aliases') || '').split(',').map((s) => s.trim()).filter(Boolean)
const title = opt('--title') || `National Standards Curriculum Guide: ${subject}, Grade${grades[0] === grades[1] ? ` ${grades[0]}` : `s ${grades[0]} to ${grades[1]}`}`
const doc = {
  title: title.slice(0, 300), subject: subject.trim().slice(0, 100), aliases, grade_from: grades[0], grade_to: grades[1],
  publisher: (opt('--publisher') || 'Ministry of Education, Youth and Information, Jamaica').slice(0, 300), published_year: opt('--year'),
  licence_note: (opt('--licence') || 'Published by the Ministry of Education. Used as reference material for lesson planning, with the source named.').slice(0, 600),
}

const bytes = fs.readFileSync(abs)
const fileHash = createHash('sha256').update(bytes).digest('hex')
let text
try { text = execFileSync('pdftotext', [abs, '-'], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { fail('Could not read the PDF. Is pdftotext (poppler) installed? On a Mac: brew install poppler') }
const pages = text.split('\f'); if (pages.length && !pages[pages.length - 1].trim()) pages.pop()
const chunks = buildChunks(pages, { gradeFrom: grades[0], gradeTo: grades[1] })
if (chunks.length === 0) fail('No readable text was found in that PDF (it may be scanned images).')
doc.pages = pages.length

const chars = chunks.reduce((n, c) => n + c.content.length, 0)
const byGrade = {}; for (const c of chunks) byGrade[c.grade ?? 'none'] = (byGrade[c.grade ?? 'none'] || 0) + 1
console.log(`${path.basename(abs)}\n  ${doc.title}\n  subject: ${doc.subject}${aliases.length ? ` (also: ${aliases.join(', ')})` : ''}   grades: ${grades[0]}-${grades[1]}   pages: ${pages.length}`)
console.log(`  ${chunks.length} pieces, ${(chars / 1000).toFixed(0)}k characters, about ${Math.round(chars / chunks.length)} characters each`)
console.log(`  pieces by grade named in the text: ${Object.entries(byGrade).map(([g, n]) => `${g}: ${n}`).join(', ')}`)
console.log(`  first piece (pages ${chunks[0].page_from}-${chunks[0].page_to}): ${chunks[0].content.slice(0, 160).replace(/\s+/g, ' ')}...`)
console.log(`  fingerprint: ${fileHash.slice(0, 16)}...`)

const emit = opt('--emit-sql')
if (emit) {
  const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
  const out = [`insert into curriculum_documents (id, title, subject, aliases, grade_from, grade_to, publisher, published_year, licence_note, pages, file_hash, status) values ('${fileHash.slice(0, 8)}-0000-4000-8000-${fileHash.slice(8, 20)}', ${q(doc.title)}, ${q(doc.subject)}, array[${aliases.map(q).join(',')}]::text[], ${doc.grade_from}, ${doc.grade_to}, ${q(doc.publisher)}, ${q(doc.published_year)}, ${q(doc.licence_note)}, ${doc.pages}, '${fileHash}', 'published');`]
  for (const c of chunks) out.push(`insert into curriculum_chunks (document_id, position, page_from, page_to, grade, heading, content) values ('${fileHash.slice(0, 8)}-0000-4000-8000-${fileHash.slice(8, 20)}', ${c.position}, ${c.page_from}, ${c.page_to}, ${c.grade ?? 'null'}, ${q(c.heading)}, ${q(c.content)});`)
  out.push(`update curriculum_documents set chunk_count = ${chunks.length} where file_hash = '${fileHash}';`)
  fs.writeFileSync(emit, out.join('\n') + '\n'); console.log(`SQL written to ${emit}`); process.exit(0)
}

const envFile = opt('--env') || '.env.local'
dotenv.config({ path: path.resolve(envFile), quiet: true })
const url = process.env.LIBRARY_SUPABASE_URL, key = process.env.LIBRARY_SUPABASE_SECRET_KEY
if (!url || !key) fail(`\nMissing LIBRARY_SUPABASE_URL or LIBRARY_SUPABASE_SECRET_KEY in ${envFile}.`)
const ref = new URL(url).hostname.split('.')[0]
console.log(`  central project: ${ref}   mode: ${has('--apply') ? 'APPLY' : 'dry run (nothing is changed)'}`)
const central = createClient(url, key, { auth: { persistSession: false } })

const { data: existing, error: lookupError } = await central.from('curriculum_documents').select('id, title, status').eq('file_hash', fileHash).maybeSingle()
if (lookupError) fail(`Could not reach the curriculum tables (${lookupError.message}). Has central migration 003 been applied?`)
if (existing) console.log(`  this exact file is already loaded as "${existing.title}" (${existing.status})${has('--replace') ? '; --replace will remove it first' : '; use --replace to load it again'}`)
if (!has('--apply')) { console.log('\nDry run only. Add --apply --project ' + ref + ' to load it.'); process.exit(0) }
if (opt('--project') !== ref) fail(`Refusing to load: add  --project ${ref}  to confirm this is the central project you mean.`)
if (existing && !has('--replace')) fail('Already loaded. Nothing changed.')
if (existing) { const { error } = await central.from('curriculum_documents').delete().eq('id', existing.id); if (error) fail(`Could not remove the old copy: ${error.message}`) }

const { data: created, error: docError } = await central.from('curriculum_documents').insert({ ...doc, file_hash: fileHash, status: 'draft' }).select('id').single()
if (docError) fail(`Could not add the document: ${docError.message}`)
for (let i = 0; i < chunks.length; i += 100) {
  const rows = chunks.slice(i, i + 100).map((c) => ({ ...c, document_id: created.id }))
  const { error } = await central.from('curriculum_chunks').insert(rows)
  if (error) { await central.from('curriculum_documents').delete().eq('id', created.id); fail(`Loading stopped at piece ${i} (${error.message}). Everything for this file was removed again.`) }
  process.stdout.write(`\r  loaded ${Math.min(i + 100, chunks.length)} of ${chunks.length}`)
}
const { count } = await central.from('curriculum_chunks').select('id', { count: 'exact', head: true }).eq('document_id', created.id)
if (count !== chunks.length) { await central.from('curriculum_documents').delete().eq('id', created.id); fail(`\nOnly ${count} of ${chunks.length} pieces arrived. Everything for this file was removed again.`) }
await central.from('curriculum_documents').update({ chunk_count: count, status: 'published' }).eq('id', created.id)
console.log(`\nDone: "${doc.title}" is live with ${count} pieces.`)
