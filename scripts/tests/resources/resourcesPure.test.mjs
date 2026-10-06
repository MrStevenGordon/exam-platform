// Run: node --import ./scripts/tests/essay-marking/resolve-ts.mjs --experimental-strip-types --no-warnings --test scripts/tests/resources/resourcesPure.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTitle, checkDescription, checkLink, checkFile, mimeFor, safeFileName, storagePath, formatSize, domainOf, toResource, filterResources, facets, extensionOf, LIMITS } from '../../../src/lib/resourcesPure.ts'

test('titles and descriptions have limits and a title is required', () => {
  assert.equal(checkTitle('Fractions worksheet'), null); assert.match(checkTitle('   '), /title/); assert.match(checkTitle('x'.repeat(151)), /150/); assert.equal(checkTitle('x'.repeat(150)), null)
  assert.equal(checkDescription(''), null); assert.match(checkDescription('x'.repeat(1001)), /1000/)
})

test('only https links with a real address are accepted, and the link is kept as typed (trimmed)', () => {
  assert.deepEqual(checkLink('  https://www.khanacademy.org/math/fractions  '), { ok: true, url: 'https://www.khanacademy.org/math/fractions' })
  assert.match(checkLink('http://example.org').error, /https/); assert.match(checkLink('www.example.org').error, /https/)
  assert.match(checkLink('javascript:alert(1)').error, /https/); assert.match(checkLink('ftp://x.org').error, /https/)
  assert.match(checkLink('https://exa mple.org').error, /spaces/); assert.match(checkLink('').error, /Paste/)
  assert.match(checkLink('https://localhost/page').error, /web address/); assert.match(checkLink('https://').error, /web address|spaces/)
  assert.match(checkLink('https://user:pass@example.org/x').error, /user name/)
  assert.match(checkLink('https://example.org/' + 'a'.repeat(2000)).error, /too long/)
})

test('files: size, type and ending are checked, with a clear message', () => {
  const ok = { name: 'Paper 1.pdf', size: 5000, type: 'application/pdf' }
  assert.equal(checkFile(ok), null)
  assert.equal(checkFile({ name: 'slides.pptx', size: 1, type: '' }), null)                       // some browsers leave the type blank
  assert.equal(checkFile({ name: 'a.docx', size: 1, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), null)
  assert.match(checkFile({ ...ok, size: 0 }), /empty/)
  assert.match(checkFile({ ...ok, size: LIMITS.fileBytes + 1 }), /The most is 20 MB/); assert.equal(checkFile({ ...ok, size: LIMITS.fileBytes }), null)
  assert.match(checkFile({ name: 'tool.exe', size: 10, type: 'application/x-msdownload' }), /not allowed/)
  assert.match(checkFile({ name: 'movie.mp4', size: 10, type: 'video/mp4' }), /not allowed/)
  assert.match(checkFile({ name: 'script.pdf', size: 10, type: 'application/x-msdownload' }), /not what its ending says/)
  assert.match(checkFile({ name: 'noending', size: 10, type: '' }), /not allowed/)
  assert.match(checkFile({ name: '  ', size: 10, type: 'application/pdf' }), /no name/)
})

test('the stored type comes from the browser when allowed, else from the ending', () => {
  assert.equal(mimeFor({ name: 'a.pdf', type: 'application/pdf' }), 'application/pdf')
  assert.equal(mimeFor({ name: 'a.PDF', type: '' }), 'application/pdf')
  assert.equal(mimeFor({ name: 'photo.JPG', type: 'application/octet-stream' }), 'image/jpeg')
  assert.equal(mimeFor({ name: 'a.xyz', type: '' }), 'application/octet-stream')
  assert.equal(extensionOf('My File.Docx'), 'docx'); assert.equal(extensionOf('noext'), '')
})

test('file names are made safe and readable, never with folders or odd characters', () => {
  assert.equal(safeFileName('Paper 1 (2024).pdf'), 'Paper-1-2024.pdf')
  assert.equal(safeFileName('../../etc/passwd'), 'etc-passwd')
  assert.equal(safeFileName('Résumé final.DOCX'), 'Resume-final.docx')
  assert.equal(safeFileName('???.pdf'), 'file.pdf'); assert.equal(safeFileName('   '), 'file')
  assert.ok(safeFileName('a'.repeat(300) + '.pdf').length <= 85); assert.match(safeFileName('a'.repeat(300) + '.pdf'), /\.pdf$/)
  assert.equal(safeFileName('x/y\\z.txt'), 'x-y-z.txt')
})

test('a file lives under its own department, which is what the storage rules read', () => {
  const p = storagePath('11111111-2222-3333-4444-555555555555', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'My Paper.pdf')
  assert.equal(p, '11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-My-Paper.pdf')
  assert.match(p, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/.+/)
})

test('sizes and addresses read plainly', () => {
  assert.equal(formatSize(500), '500 B'); assert.equal(formatSize(2048), '2 KB'); assert.equal(formatSize(1536 * 1024), '1.5 MB'); assert.equal(formatSize(20 * 1024 * 1024), '20 MB')
  assert.equal(domainOf('https://www.khanacademy.org/math'), 'khanacademy.org'); assert.equal(domainOf('nonsense'), '')
})

const row = (o) => ({ id: o.id, title: 'T', description: '', kind: 'link', url: 'https://e.org', file_path: null, file_name: null, file_size: null, subject: 'Mathematics', grade: 8, topic_id: null, topic_name: null, pinned: false, created_at: '2026-10-01T00:00:00Z', shared_by: 'Tina Teacher', mine: false, can_edit: false, can_remove: false, can_pin: false, ...o })
test('rows from the database become resources with safe defaults', () => {
  const r = toResource(row({ id: 'a', kind: 'file', file_path: 'd/a.pdf', file_name: 'a.pdf', file_size: 10, pinned: true, mine: true, can_edit: true, can_remove: true }))
  assert.equal(r.kind, 'file'); assert.equal(r.filePath, 'd/a.pdf'); assert.equal(r.pinned, true); assert.equal(r.canEdit, true); assert.equal(r.canPin, false)
  const bad = toResource({ id: 5 })
  assert.equal(bad.id, '5'); assert.equal(bad.kind, 'link'); assert.equal(bad.sharedBy, 'A colleague'); assert.equal(bad.pinned, false); assert.equal(bad.grade, null)
})

const list = [
  toResource(row({ id: '1', title: 'Fractions worksheet', description: 'Adding and subtracting', created_at: '2026-10-03T00:00:00Z' })),
  toResource(row({ id: '2', title: 'Algebra past paper', subject: 'Mathematics', grade: 10, kind: 'file', file_name: 'paper.pdf', created_at: '2026-10-05T00:00:00Z' })),
  toResource(row({ id: '3', title: 'Cell diagrams', subject: 'Integrated Science', grade: 8, topic_name: 'Cells', shared_by: 'Sam', created_at: '2026-10-04T00:00:00Z' })),
  toResource(row({ id: '4', title: 'Old pinned guide', pinned: true, created_at: '2026-09-01T00:00:00Z' })),
]
test('the shelf shows pinned first, then newest', () => assert.deepEqual(filterResources(list, { search: '', subject: '', grade: '', kind: '' }).map((r) => r.id), ['4', '2', '3', '1']))
test('search needs every word, in the title, description, subject, topic, file name or sharer, ignoring case', () => {
  const ids = (s) => filterResources(list, { search: s, subject: '', grade: '', kind: '' }).map((r) => r.id)
  assert.deepEqual(ids('FRACTIONS adding'), ['1']); assert.deepEqual(ids('cells'), ['3']); assert.deepEqual(ids('sam'), ['3']); assert.deepEqual(ids('paper.pdf'), ['2'])
  assert.deepEqual(ids('fractions algebra'), []); assert.deepEqual(ids('  integrated   science '), ['3']); assert.deepEqual(ids('zzz'), [])
})
test('filters by subject, grade and type', () => {
  const f = (o) => filterResources(list, { search: '', subject: '', grade: '', kind: '', ...o }).map((r) => r.id)
  assert.deepEqual(f({ subject: 'mathematics' }), ['4', '2', '1']); assert.deepEqual(f({ grade: '8' }), ['4', '3', '1']); assert.deepEqual(f({ kind: 'file' }), ['2'])
  assert.deepEqual(f({ subject: 'Mathematics', grade: '10', kind: 'file' }), ['2'])
})
test('filters offered come from what is on the shelf, once each', () => {
  assert.deepEqual(facets(list), { subjects: ['Integrated Science', 'Mathematics'], grades: [8, 10] })
  assert.deepEqual(facets([toResource(row({ id: 'x', subject: 'Maths' })), toResource(row({ id: 'y', subject: ' maths ' }))]).subjects.length, 1)
  assert.deepEqual(facets([]), { subjects: [], grades: [] })
})
