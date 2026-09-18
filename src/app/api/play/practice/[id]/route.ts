import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId, UUID_RE } from '@/lib/playAuth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Practice not found.' }, { status: 404 })

  try {
    const pool = getPlayPool()
    const session = await pool.query(
      `select id, subject, topic, question_count, completed_at, score::float, max_score::float
         from play_practice_sessions where id = $1 and account_id = $2`,
      [id, accountId]
    )
    if (session.rows.length === 0) return NextResponse.json({ error: 'Practice not found.' }, { status: 404 })

    const questions = await pool.query(
      `select q.id, a.order_index, q.question_type, q.question_text, q.options, q.points,
              (a.answered_at is not null) as answered,
              a.answer, a.points_awarded::float,
              case when a.answered_at is not null then q.correct_answer end as correct_answer,
              case when a.answered_at is not null then q.explanation end as explanation
         from play_practice_answers a
         join play_questions q on q.id = a.question_id
        where a.session_id = $1
        order by a.order_index`,
      [id]
    )
    return NextResponse.json({ session: session.rows[0], questions: questions.rows })
  } catch (err) {
    console.error('Play practice load failed', err)
    return NextResponse.json({ error: 'Something went wrong loading this practice.' }, { status: 500 })
  }
}
