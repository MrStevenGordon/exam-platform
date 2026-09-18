import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'
import { parseImport } from '@/lib/playQuestionImport'
import type { ValidQuestion } from '@/lib/playQuestionInput'

const MAX_REPORTED = 100

type Issue = { row: number; message: string }

// One endpoint for both steps. With commit=false it only checks the file and
// reports what would happen; with commit=true it re-parses and re-validates
// the same text on the server and inserts the good rows in one transaction.
// The browser never sends pre-validated rows, so nothing is trusted.
export async function POST(request: Request) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const status = body?.status === 'approved' ? 'approved' : body?.status === 'draft' ? 'draft' : null
  if (!status) return NextResponse.json({ error: 'Choose whether to import as drafts or approved questions.' }, { status: 400 })
  const commit = body?.commit === true

  const parsed = parseImport(body?.text, status)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')

    // Reuse the bank's existing spelling of subjects and topics, and remember
    // the first spelling seen in this file so one file cannot split a topic.
    const existingTopics = await client.query('select subject, topic from play_questions group by 1, 2')
    const subjectSpelling = new Map<string, string>()
    const topicSpelling = new Map<string, string>()
    for (const r of existingTopics.rows) {
      if (!subjectSpelling.has(r.subject.toLowerCase())) subjectSpelling.set(r.subject.toLowerCase(), r.subject)
      topicSpelling.set(`${r.subject.toLowerCase()}\u0001${r.topic.toLowerCase()}`, r.topic)
    }
    const existingQuestions = await client.query(`select subject, topic, lower(trim(question_text)) as t from play_questions where status <> 'archived'`)
    const seen = new Set<string>(existingQuestions.rows.map((r) => `${r.subject}\u0001${r.topic}\u0001${r.t}`))

    const errors: Issue[] = []
    const duplicates: Issue[] = []
    const importable: { row: number; q: ValidQuestion }[] = []

    for (const r of parsed.rows) {
      if (!r.ok) { errors.push({ row: r.rowNumber, message: r.error }); continue }
      const q = { ...r.question }
      const sKey = q.subject.toLowerCase()
      q.subject = subjectSpelling.get(sKey) ?? q.subject
      subjectSpelling.set(sKey, q.subject)
      const tKey = `${sKey}\u0001${q.topic.toLowerCase()}`
      q.topic = topicSpelling.get(tKey) ?? q.topic
      topicSpelling.set(tKey, q.topic)

      const dupKey = `${q.subject}\u0001${q.topic}\u0001${q.questionText.trim().toLowerCase()}`
      if (seen.has(dupKey)) { duplicates.push({ row: r.rowNumber, message: 'Already in the question bank (or repeated in this file), so it was skipped.' }); continue }
      seen.add(dupKey)
      importable.push({ row: r.rowNumber, q })
    }

    let imported = 0
    if (commit) {
      for (const { q } of importable) {
        await client.query(
          `insert into play_questions (subject, topic, question_type, question_text, options, correct_answer, points, explanation, status, created_by, updated_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
          [q.subject, q.topic, q.questionType, q.questionText, q.options ? JSON.stringify(q.options) : null, q.correctAnswer, q.points, q.explanation, status, teacherId]
        )
        imported++
      }
      await client.query('commit')
    } else {
      await client.query('rollback')
    }

    const byTopic = new Map<string, number>()
    for (const { q } of importable) byTopic.set(`${q.subject} · ${q.topic}`, (byTopic.get(`${q.subject} · ${q.topic}`) ?? 0) + 1)

    return NextResponse.json({
      committed: commit,
      total: parsed.total,
      importable: importable.length,
      imported,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      errors: errors.slice(0, MAX_REPORTED),
      duplicates: duplicates.slice(0, MAX_REPORTED),
      topics: Array.from(byTopic, ([label, count]) => ({ label, count })),
      sample: importable.slice(0, 8).map(({ row, q }) => ({
        row, subject: q.subject, topic: q.topic, type: q.questionType, question: q.questionText, correctAnswer: q.correctAnswer, points: q.points,
      })),
    })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play question import failed', err)
    return NextResponse.json({ error: 'Something went wrong importing. Nothing was saved.' }, { status: 500 })
  } finally {
    client.release()
  }
}
