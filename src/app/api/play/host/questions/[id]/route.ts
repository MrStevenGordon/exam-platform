import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId, UUID_RE } from '@/lib/playAuth'
import { validateQuestionInput } from '@/lib/playQuestionInput'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

  try {
    const { rows } = await getPlayPool().query(
      `select q.id, q.subject, q.topic, q.question_type, q.question_text, q.options, q.correct_answer, q.points, q.explanation, q.status,
              (select count(*)::int from play_practice_answers a where a.question_id = q.id and a.answered_at is not null)
              + (select count(*)::int from play_duel_answers a where a.question_id = q.id)
              + (select count(*)::int from play_live_answers a where a.question_id = q.id) as times_answered
         from play_questions q where q.id = $1`,
      [id]
    )
    const r = rows[0]
    if (!r) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json({
      question: {
        id: r.id, subject: r.subject, topic: r.topic, questionType: r.question_type, questionText: r.question_text,
        options: r.options, correctAnswer: r.correct_answer, points: r.points, explanation: r.explanation, status: r.status,
        timesAnswered: r.times_answered,
      },
    })
  } catch (err) {
    console.error('Play question load failed', err)
    return NextResponse.json({ error: 'Something went wrong loading the question.' }, { status: 500 })
  }
}

// Full replacement of the editable fields. Archiving/restoring goes through
// the same call with a different status; questions are never deleted.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const parsed = validateQuestionInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value

  try {
    const pool = getPlayPool()
    const canon = await pool.query(
      `select (select subject from play_questions where lower(subject) = lower($1) limit 1) as subject,
              (select topic from play_questions where lower(subject) = lower($1) and lower(topic) = lower($2) limit 1) as topic`,
      [v.subject, v.topic]
    )
    const subject = canon.rows[0].subject ?? v.subject
    const topic = canon.rows[0].topic ?? v.topic

    const dup = await pool.query(
      `select 1 from play_questions where id <> $4 and subject = $1 and topic = $2 and lower(trim(question_text)) = lower($3) and status <> 'archived'`,
      [subject, topic, v.questionText, id]
    )
    if (dup.rows.length > 0 && v.status !== 'archived') return NextResponse.json({ error: 'That question already exists in this topic.' }, { status: 409 })

    const res = await pool.query(
      `update play_questions
          set subject = $2, topic = $3, question_type = $4, question_text = $5, options = $6, correct_answer = $7,
              points = $8, explanation = $9, status = $10, updated_by = $11, updated_at = now()
        where id = $1
        returning id`,
      [id, subject, topic, v.questionType, v.questionText, v.options ? JSON.stringify(v.options) : null, v.correctAnswer, v.points, v.explanation, v.status, teacherId]
    )
    if (res.rowCount === 0) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Play question update failed', err)
    return NextResponse.json({ error: 'Something went wrong saving the question.' }, { status: 500 })
  }
}

// Quick status change from the list (approve a draft, archive, restore).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!['draft', 'approved', 'archived'].includes(body?.status)) return NextResponse.json({ error: 'Pick a status.' }, { status: 400 })

  try {
    const res = await getPlayPool().query(
      `update play_questions set status = $2, updated_by = $3, updated_at = now() where id = $1 returning id`,
      [id, body.status, teacherId]
    )
    if (res.rowCount === 0) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Play question status failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
