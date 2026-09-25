import { supabase } from '@/lib/supabase'

export type TopicStatus = 'active' | 'proposed' | 'archived'

export type Topic = {
  id: string
  code: string
  subject: string
  grade: number
  unit: string | null
  name: string
  sort_order: number
  status: TopicStatus
  merged_into: string | null
}

// What a screen needs to remember about a chosen topic.
export type TopicChoice = { id: string; name: string; code: string }

export const GRADES = [7, 8, 9, 10, 11] as const

// "Grade 9", "grade 9", "9", 9 -> 9. Anything else (or out of range) -> null.
export function gradeFromText(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const m = String(v).match(/\d{1,2}/)
  if (!m) return null
  const g = Number(m[0])
  return g >= 7 && g <= 13 ? g : null
}

export type TopicCsvRow = { subject: string; grade: number; unit: string | null; name: string }

// One row per topic: subject, grade, unit (optional), topic. Commas, tabs (pasted
// from Excel) or semicolons all work; a header row is recognised and skipped.
export function parseTopicsCsv(text: string): { rows: TopicCsvRow[]; errors: string[] } {
  const rows: TopicCsvRow[] = []
  const errors: string[] = []
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)

  lines.forEach((raw, i) => {
    if (!raw.trim()) return
    const cells = splitLine(raw)
    if (i === 0 && /^subject$/i.test(cells[0]?.trim() ?? '')) return
    if (cells.length < 3) { errors.push(`Line ${i + 1}: expected subject, grade, unit, topic`); return }
    const [subject, gradeText, ...rest] = cells
    const name = (rest.length >= 2 ? rest[1] : rest[0]).trim()
    const unit = rest.length >= 2 ? rest[0].trim() || null : null
    const grade = gradeFromText(gradeText)
    if (!subject.trim()) { errors.push(`Line ${i + 1}: the subject is missing`); return }
    if (grade === null) { errors.push(`Line ${i + 1}: "${gradeText}" is not a grade from 7 to 13`); return }
    if (!name) { errors.push(`Line ${i + 1}: the topic name is missing`); return }
    rows.push({ subject: subject.trim(), grade, unit, name })
  })
  return { rows, errors }
}

function splitLine(line: string): string[] {
  const delimiter = line.includes('\t') ? '\t' : line.includes(';') && !line.includes(',') ? ';' : ','
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

export const TOPICS_CSV_TEMPLATE = 'subject,grade,unit,topic\nMathematics,9,Consumer arithmetic,Simple interest\nMathematics,9,Consumer arithmetic,Compound interest\n'

let availability: Promise<boolean> | null = null

// The topic list needs its database table (migration 058). Until it exists, every
// screen that offers topics stays hidden, so nothing can break. Checked once per page load.
export function isTopicsAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      try {
        const { error } = await supabase.from('curriculum_topics').select('id').limit(1)
        return !error
      } catch {
        return false
      }
    })()
  }
  return availability
}
