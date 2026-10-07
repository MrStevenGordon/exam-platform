// Cuts a curriculum guide's text into pieces for search. Pure functions (no files, no network) so they can be tested.
// Input: the text of each page (as pdftotext gives it). Output: chunks with the pages they come from and the unit or grade heading
// they sit under.

const TARGET = 1800      // aim for about this many characters per piece
const MAX = 2400         // never more than this (the database allows 6,000)
const MIN_PAGE_TEXT = 120

// Lines that are furniture, not content: page numbers, the copyright footer, the running title.
const FURNITURE = [
  /^\s*\d{1,3}\s*$/,
  /©.*ministry of education/i,
  /^\s*APSE1\s*$/i,
  /^\s*national standards curriculum( guide)?\s*$/i,
  /^\s*page \d+( of \d+)?\s*$/i,
]

export function cleanPage(raw) {
  const lines = String(raw || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/g, ''))
  const kept = lines.filter((l) => l.trim() && !FURNITURE.some((re) => re.test(l)))
  // Join a word split across two lines with a hyphen ("documen-" / "tation"), then collapse spaces inside lines.
  const joined = kept.join('\n').replace(/([a-z])-\n([a-z])/g, '$1$2')
  return joined.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
}

// A heading line such as "GRADE 7, TERM 1, UNIT 2" or "UNIT 4: Parts of speech". Short, and starts with Grade, Term or Unit.
// Capital first letter and then a number, a number word, a colon or "title": a heading, not a sentence that happens to start with "unit".
const HEADING_RE = /^(GRADE|Grade|TERM|Term|UNIT|Unit)\b[ :.-]*(?:\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|One|Two|Three|Four|Five|Six|TITLE|Title|[A-Z]{3,})\b.{0,100}$/
export function headingGrade(line) {
  const m = /\bGRADE\s*(7|8|9|10|11|12|13)\b/i.exec(line)
  return m ? Number(m[1]) : null
}

// The text of a page, as paragraphs, and any heading it carries.
function paragraphs(lines) {
  const out = []
  let cur = ''
  for (const l of lines) {
    const startsNew = /^[•\-–▪●◦]/.test(l) || /^[A-Z][A-Z0-9 ,:&'’()/-]{6,}$/.test(l)
    if (startsNew && cur) { out.push(cur); cur = l } else cur = cur ? `${cur} ${l}` : l
    if (/[.:;!?]$/.test(l) && cur.length > 400) { out.push(cur); cur = '' }
  }
  if (cur) out.push(cur)
  return out
}

function splitLong(text) {
  if (text.length <= MAX) return [text]
  const parts = []
  let rest = text
  while (rest.length > MAX) {
    let cut = rest.lastIndexOf('. ', MAX)
    if (cut < MAX / 2) cut = rest.lastIndexOf(' ', MAX)
    if (cut < MAX / 2) cut = MAX
    parts.push(rest.slice(0, cut + 1).trim())
    rest = rest.slice(cut + 1).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

// gradeFrom and gradeTo are the grades the guide covers: a mention of some other grade in the text ("GRADE 10 ...") is not treated as a section heading.
export function buildChunks(pages, { gradeFrom = 7, gradeTo = 13 } = {}) {
  const chunks = []
  let grade = null, heading = null
  let buf = [], bufLen = 0, from = null, to = null, bufGrade = null, bufHeading = null
  const flush = () => {
    if (!buf.length) return
    chunks.push({ position: chunks.length, page_from: from, page_to: to, grade: bufGrade, heading: bufHeading, content: buf.join('\n') })
    buf = []; bufLen = 0; from = null; to = null
  }
  pages.forEach((raw, i) => {
    const pageNo = i + 1
    const lines = cleanPage(raw)
    const textLen = lines.join(' ').length
    if (textLen < MIN_PAGE_TEXT) return
    // Cut the page where a heading starts, so a piece never mixes two units and carries the right heading.
    const segs = []
    let cur = []
    for (const l of lines) {
      if (HEADING_RE.test(l.trim()) && cur.length) { segs.push(cur); cur = [l] } else cur.push(l)
    }
    segs.push(cur)
    for (const seg of segs) {
      if (HEADING_RE.test(seg[0].trim())) {
        flush()
        const g = headingGrade(seg[0])
        if (g && g >= gradeFrom && g <= gradeTo) grade = g
        heading = seg[0].trim().slice(0, 200)
      }
      for (const p of paragraphs(seg).flatMap(splitLong)) {
        if (bufLen > 0 && bufLen + p.length > TARGET) flush()
        if (!buf.length) { from = pageNo; bufGrade = grade; bufHeading = heading }
        buf.push(p); bufLen += p.length + 1; to = pageNo
      }
    }
  })
  flush()
  return chunks
}

// "7-9" -> [7, 9]; "8" -> [8, 8]
export function parseGrades(text) {
  const m = /^\s*(\d{1,2})\s*(?:[-–]|to)?\s*(\d{1,2})?\s*$/.exec(String(text || ''))
  if (!m) return null
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a
  return a >= 7 && b <= 13 && b >= a ? [a, b] : null
}
