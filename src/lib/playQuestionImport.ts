import { validateQuestionInput, type QuestionType, type ValidQuestion } from '@/lib/playQuestionInput'

export const MAX_IMPORT_ROWS = 500
export const MAX_IMPORT_CHARS = 1_000_000

export const TEMPLATE_COLUMNS = ['subject', 'topic', 'type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'correct_answer', 'points', 'explanation']

export const TEMPLATE_ROWS: string[][] = [
  ['Mathematics', 'Geometry', 'multiple_choice', 'Which shape has four equal sides and four right angles?', 'Square', 'Rhombus', 'Trapezium', 'Kite', '', '', 'A', '1', 'A square has equal sides and right angles.'],
  ['Mathematics', 'Algebra', 'true_false', 'The value of x in x + 5 = 9 is 4.', '', '', '', '', '', '', 'true', '1', 'Subtract 5 from both sides.'],
  ['Mathematics', 'Fractions', 'fill_blank', 'One half written as a decimal is ____', '', '', '', '', '', '', '0.5', '1', '1 ÷ 2 = 0.5.'],
  ['Mathematics', 'Percentages', 'short_answer', 'What is 50% of 90?', '', '', '', '', '', '', '45', '2', '50% is half of 90.'],
]

// Parses delimited text (CSV, semicolon-separated CSV from some Excel locales,
// or tab-separated text pasted from a spreadsheet). Handles quoted fields,
// doubled quotes and line breaks inside quotes.
export function parseDelimited(input: string): string[][] {
  let text = input.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (ch: string) => {
    let n = 0
    let inQuotes = false
    for (const c of firstLine) {
      if (c === '"') inQuotes = !inQuotes
      else if (c === ch && !inQuotes) n++
    }
    return n
  }
  const delimiter = [',', '\t', ';'].map((d) => ({ d, n: count(d) })).sort((a, b) => b.n - a.n)[0].d

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"' && field === '') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += c
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

const TYPE_ALIASES: Record<string, QuestionType> = {
  multiplechoice: 'multiple_choice', multiple_choice: 'multiple_choice', mcq: 'multiple_choice', mc: 'multiple_choice',
  truefalse: 'true_false', true_false: 'true_false', tf: 'true_false', trueorfalse: 'true_false',
  fillintheblank: 'fill_blank', fillblank: 'fill_blank', fill_blank: 'fill_blank', fill: 'fill_blank', fillinblank: 'fill_blank',
  shortanswer: 'short_answer', short_answer: 'short_answer', short: 'short_answer',
}

type ColumnMap = { subject: number; topic: number; type: number; question: number; correct: number; points: number; explanation: number; options: number[] }

// Finds which column holds what, by header name. Returns an error message when
// a required column is missing.
export function mapColumns(header: string[]): { ok: true; map: ColumnMap } | { ok: false; error: string } {
  const find = (names: string[]) => header.findIndex((h) => names.includes(norm(h)))
  const options: number[] = []
  const letters = ['a', 'b', 'c', 'd', 'e', 'f']
  for (let n = 0; n < 6; n++) {
    const idx = header.findIndex((h) => {
      const k = norm(h)
      return k === `option${letters[n]}` || k === `choice${letters[n]}` || k === `option${n + 1}` || k === `choice${n + 1}`
    })
    if (idx >= 0) options.push(idx)
  }
  const map: ColumnMap = {
    subject: find(['subject']),
    topic: find(['topic']),
    type: find(['type', 'questiontype']),
    question: find(['question', 'questiontext', 'text']),
    correct: find(['correctanswer', 'correct', 'answer', 'key']),
    points: find(['points', 'marks']),
    explanation: find(['explanation']),
    options,
  }
  const missing: string[] = []
  if (map.subject < 0) missing.push('subject')
  if (map.topic < 0) missing.push('topic')
  if (map.question < 0) missing.push('question')
  if (map.correct < 0) missing.push('correct_answer')
  if (missing.length > 0) return { ok: false, error: `The first row must be a header row that includes these columns: ${missing.join(', ')}. Download the template to see the layout.` }
  return { ok: true, map }
}

export type ImportRow =
  | { rowNumber: number; ok: true; question: ValidQuestion }
  | { rowNumber: number; ok: false; error: string }

const LETTER_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5 }

// Turns one spreadsheet row into a validated question, applying friendly
// conventions (type aliases, letter answers, inferred type, default points),
// then hands it to the same validator manual entry uses.
export function normalizeRow(cells: string[], map: ColumnMap, rowNumber: number, status: 'draft' | 'approved'): ImportRow {
  const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '')
  const subject = get(map.subject)
  const topic = get(map.topic)
  const questionText = get(map.question)
  const correctRaw = get(map.correct)
  const explanation = get(map.explanation)
  const typeRaw = get(map.type)
  // Blank option cells are skipped; the rest keep their order.
  const options = map.options.map(get).filter((o) => o !== '')

  let questionType: QuestionType | null = null
  if (typeRaw) {
    questionType = TYPE_ALIASES[norm(typeRaw)] ?? TYPE_ALIASES[typeRaw.toLowerCase()] ?? null
    if (!questionType) return { rowNumber, ok: false, error: `Unknown type "${typeRaw}". Use multiple_choice, true_false, fill_blank or short_answer.` }
  } else if (options.length >= 2) {
    questionType = 'multiple_choice'
  } else if (['true', 'false', 't', 'f'].includes(correctRaw.toLowerCase())) {
    questionType = 'true_false'
  } else if (/_{2,}/.test(questionText)) {
    questionType = 'fill_blank'
  } else {
    questionType = 'short_answer'
  }

  let correctAnswer = correctRaw
  if (questionType === 'multiple_choice') {
    const exact = options.find((o) => o.toLowerCase() === correctRaw.toLowerCase())
    if (exact) correctAnswer = exact
    else {
      // A letter or number refers to the position among the columns as laid out
      // (option_a = A) so blank cells do not shift the letters.
      const idx = LETTER_INDEX[correctRaw.toLowerCase()]
      const byColumn = idx !== undefined ? get(map.options[idx] ?? -1) : ''
      if (byColumn) correctAnswer = byColumn
    }
  } else if (questionType === 'true_false') {
    const v = correctRaw.toLowerCase()
    correctAnswer = v === 't' ? 'true' : v === 'f' ? 'false' : v
  }

  let points = 1
  const pointsRaw = get(map.points)
  if (pointsRaw !== '') points = Number(pointsRaw)

  const result = validateQuestionInput({
    subject, topic, questionType, questionText,
    options: questionType === 'multiple_choice' ? options : null,
    correctAnswer, points, explanation, status,
  })
  return result.ok ? { rowNumber, ok: true, question: result.value } : { rowNumber, ok: false, error: result.error }
}

export type ParsedImport =
  | { ok: false; error: string }
  | { ok: true; rows: ImportRow[]; total: number }

export function parseImport(text: string, status: 'draft' | 'approved'): ParsedImport {
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, error: 'The file is empty.' }
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: 'That file is too large. Split it into smaller files.' }
  if (text.startsWith('PK')) return { ok: false, error: 'That looks like an Excel (.xlsx) file. In Excel choose Save As, then CSV UTF-8, and upload that file. Or copy the cells and paste them.' }
  if (text.includes('\uFFFD')) return { ok: false, error: 'Some characters could not be read. In Excel choose Save As, then "CSV UTF-8 (Comma delimited)".' }

  const table = parseDelimited(text)
  if (table.length < 2) return { ok: false, error: 'Add a header row followed by at least one question.' }
  const mapped = mapColumns(table[0])
  if (!mapped.ok) return { ok: false, error: mapped.error }

  const dataRows = table.slice(1)
  if (dataRows.length > MAX_IMPORT_ROWS) return { ok: false, error: `That file has ${dataRows.length} questions. Import up to ${MAX_IMPORT_ROWS} at a time.` }

  // Spreadsheet row numbers count the header as row 1.
  const rows = dataRows.map((cells, i) => normalizeRow(cells, mapped.map, i + 2, status))
  return { ok: true, rows, total: rows.length }
}

// CSV cell quoting for the template download.
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n')
}
