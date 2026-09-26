import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId, UUID_RE } from '@/lib/playAuth'
import { gradeAnswer } from '@/lib/grading'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { id } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const questionId = typeof body?.questionId === 'string' ? body.questionId : ''
  const answer = typeof body?.answer === 'string' ? body.answer.trim() : ''
  if (!UUID_RE.test(id) || !UUID_RE.test(questionId)) return NextResponse.json({ error: 'Practice not found.' }, { status: 404 })
  if (!answer || answer.length > 500) return NextResponse.json({ error: 'Enter an answer first.' }, { status: 400 })

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    const row = await client.query(
      `select a.answered_at, q.question_type, q.correct_answer, q.points, q.explanation
         from play_practice_answers a
         join play_practice_sessions s on s.id = a.session_id
         join play_questions q on q.id = a.question_id
        where a.session_id = $1 and a.question_id = $2 and s.account_id = $3
          for update of a`,
      [id, questionId, accountId]
    )
    if (row.rows.length === 0) {
      await client.query('rollback')
      return NextResponse.json({ error: 'Question not found in this practice.' }, { status: 404 })
    }
    const q = row.rows[0]
    if (q.answered_at) {
      await client.query('rollback')
      return NextResponse.json({ error: 'You already answered this question.' }, { status: 409 })
    }

    const awarded = gradeAnswer(
      { question_type: q.question_type, points: q.points, correct_answer: q.correct_answer },
      answer
    ) ?? 0
    await client.query(
      'update play_practice_answers set answer = $3, points_awarded = $4, answered_at = now() where session_id = $1 and question_id = $2',
      [id, questionId, answer, awarded]
    )

    const remaining = await client.query(
      'select count(*)::int as n from play_practice_answers where session_id = $1 and answered_at is null',
      [id]
    )
    let completed = false
    let score: number | null = null
    let maxScore: number | null = null
    if (remaining.rows[0].n === 0) {
      const totals = await client.query(
        `select coalesce(sum(a.points_awarded), 0)::float as score, sum(q.points)::float as max_score
           from play_practice_answers a join play_questions q on q.id = a.question_id
          where a.session_id = $1`,
        [id]
      )
      score = totals.rows[0].score
      maxScore = totals.rows[0].max_score
      await client.query('update play_practice_sessions set completed_at = now(), score = $2, max_score = $3 where id = $1', [id, score, maxScore])
      completed = true
    }
    await client.query('commit')

    return NextResponse.json({
      correct: awarded === q.points,
      pointsAwarded: awarded,
      maxPoints: q.points,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      completed,
      score,
      maxScore,
    })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play practice answer failed', err)
    return NextResponse.json({ error: 'Something went wrong saving that answer.' }, { status: 500 })
  } finally {
    client.release()
  }
}
