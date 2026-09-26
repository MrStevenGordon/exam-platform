import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId, UUID_RE } from '@/lib/playAuth'
import { gradeAnswer } from '@/lib/grading'
import { loadDuelSummaries } from '@/lib/playDuels'

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
  if (!UUID_RE.test(id) || !UUID_RE.test(questionId)) return NextResponse.json({ error: 'Duel not found.' }, { status: 404 })
  if (!answer || answer.length > 500) return NextResponse.json({ error: 'Enter an answer first.' }, { status: 400 })

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    // The question must belong to this duel, the caller must be a
    // participant, and they must currently be allowed to play it.
    const row = await client.query(
      `select d.created_by, d.opponent_id, d.status, q.question_type, q.correct_answer, q.points, q.explanation
         from play_duels d
         join play_duel_questions dq on dq.duel_id = d.id
         join play_questions q on q.id = dq.question_id
        where d.id = $1 and dq.question_id = $2 and (d.created_by = $3 or d.opponent_id = $3)`,
      [id, questionId, accountId]
    )
    const q = row.rows[0]
    const allowed = q && ((q.created_by === accountId && q.status !== 'declined') || (q.opponent_id === accountId && q.status === 'active'))
    if (!allowed) {
      await client.query('rollback')
      return NextResponse.json({ error: 'Question not found in this duel.' }, { status: 404 })
    }

    const awarded = gradeAnswer({ question_type: q.question_type, points: q.points, correct_answer: q.correct_answer }, answer) ?? 0
    const inserted = await client.query(
      `insert into play_duel_answers (duel_id, account_id, question_id, answer, points_awarded)
       values ($1, $2, $3, $4, $5)
       on conflict do nothing`,
      [id, accountId, questionId, answer, awarded]
    )
    if (inserted.rowCount === 0) {
      await client.query('rollback')
      return NextResponse.json({ error: 'You already answered this question.' }, { status: 409 })
    }
    await client.query('commit')

    const [summary] = await loadDuelSummaries(accountId, id)
    return NextResponse.json({
      correct: awarded === q.points,
      pointsAwarded: awarded,
      maxPoints: q.points,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      completed: summary.myFinished,
      result: summary.result,
    })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play duel answer failed', err)
    return NextResponse.json({ error: 'Something went wrong saving that answer.' }, { status: 500 })
  } finally {
    client.release()
  }
}
