import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'
import { gradeAnswer } from '@/lib/grading'
import { GRACE_MS, findGameByCode, pointsFor } from '@/lib/playLive'

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { code } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const answer = typeof body?.answer === 'string' ? body.answer.trim() : ''
  if (!answer || answer.length > 500) return NextResponse.json({ error: 'Pick an answer.' }, { status: 400 })

  const pool = getPlayPool()
  try {
    const game = await findGameByCode(pool, code)
    if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
    const joined = await pool.query('select 1 from play_live_players where game_id = $1 and account_id = $2', [game.id, accountId])
    if (joined.rows.length === 0) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })

    // Only while the stored question is still running. Uses the database clock,
    // so a slow or tampered browser clock cannot buy extra time.
    const limitMs = game.seconds_per_question * 1000
    if (game.status !== 'question' || (game.elapsed_ms ?? 0) > limitMs + GRACE_MS) {
      return NextResponse.json({ error: 'Time is up for this question.' }, { status: 409 })
    }

    const q = await pool.query(
      `select q.id, q.question_type, q.correct_answer, q.points, q.options
         from play_live_questions lq join play_questions q on q.id = lq.question_id
        where lq.game_id = $1 and lq.order_index = $2`,
      [game.id, game.current_index]
    )
    const question = q.rows[0]
    if (!question) return NextResponse.json({ error: 'No question is running.' }, { status: 409 })

    // Live questions are tap-to-answer, so the answer must be one of the
    // options actually offered on screen.
    const offered: string[] = question.question_type === 'true_false' ? ['true', 'false'] : (question.options ?? []).map((o: string) => o.trim().toLowerCase())
    if (!offered.includes(answer.toLowerCase())) return NextResponse.json({ error: 'Pick one of the answers shown.' }, { status: 400 })

    const awarded = gradeAnswer({ question_type: question.question_type, points: question.points, correct_answer: question.correct_answer }, answer) ?? 0
    const correct = awarded === question.points
    const points = pointsFor(correct, game.elapsed_ms ?? 0, limitMs)

    const inserted = await pool.query(
      `insert into play_live_answers (game_id, account_id, question_id, answer, correct, points, response_ms)
       values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
      [game.id, accountId, question.id, answer, correct, points, game.elapsed_ms ?? 0]
    )
    if (inserted.rowCount === 0) return NextResponse.json({ error: 'You already answered this question.' }, { status: 409 })

    // Correctness is intentionally not returned: it is revealed for everyone
    // together when the question ends.
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Play live answer failed', err)
    return NextResponse.json({ error: 'Something went wrong saving your answer.' }, { status: 500 })
  }
}
