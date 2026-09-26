import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'
import { gradeAnswer } from '@/lib/grading'
import { STUMBLE_MS, findTugByCode, finishGame, nextRecent, pickQuestion, questionView, standing, teamTallies } from '@/lib/playTug'

// One student answers their current question. Everything is decided here: the
// question must be the one they were served, a student who just got one wrong
// must wait out the stumble, and after recording the answer the game row lock
// (held throughout) lets us check whether this pull decided the game.
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

  const client = await getPlayPool().connect()
  const fail = async (status: number, error: string, extra: Record<string, unknown> = {}) => { await client.query('rollback'); return NextResponse.json({ error, ...extra }, { status }) }
  try {
    await client.query('begin')
    const locked = await client.query(`select id from play_tug_games where code = $1 and status <> 'ended' for update`, [code])
    const game = locked.rows.length > 0 ? await findTugByCode(client, code) : null
    if (!game || game.id !== locked.rows[0].id) return await fail(404, 'Game not found.')

    const player = await client.query('select team_id from play_tug_players where game_id = $1 and account_id = $2', [game.id, accountId])
    if (player.rows.length === 0) return await fail(404, 'Game not found.')
    if (game.status !== 'running') return await fail(409, 'The game is not running.')
    if ((game.elapsed_ms ?? 0) >= game.duration_seconds * 1000) {
      await finishGame(client, game.id, 'time')
      await client.query('commit')
      return NextResponse.json({ error: 'Time is up!', ended: true }, { status: 409 })
    }

    const st = await client.query(
      `select s.current_question_id, s.recent_question_ids,
              greatest(0, (extract(epoch from (s.locked_until - clock_timestamp())) * 1000))::int as locked_ms,
              q.question_type, q.correct_answer, q.points, q.options
         from play_tug_player_state s left join play_questions q on q.id = s.current_question_id
        where s.game_id = $1 and s.account_id = $2 for update of s`,
      [game.id, accountId]
    )
    const s = st.rows[0]
    if (!s || !s.current_question_id) return await fail(409, 'No question is waiting for you.')
    if (s.locked_ms > 0) return await fail(409, 'You are still recovering from that stumble.', { lockMs: s.locked_ms })

    const offered: string[] = s.question_type === 'true_false' ? ['true', 'false'] : (s.options ?? []).map((o: string) => o.trim().toLowerCase())
    if (!offered.includes(answer.toLowerCase())) return await fail(400, 'Pick one of the answers shown.')

    const correct = (gradeAnswer({ question_type: s.question_type, points: s.points, correct_answer: s.correct_answer }, answer) ?? 0) === s.points
    await client.query(
      'insert into play_tug_answers (game_id, account_id, team_id, question_id, answer, correct) values ($1, $2, $3, $4, $5, $6)',
      [game.id, accountId, player.rows[0].team_id, s.current_question_id, answer, correct]
    )

    // Did that pull settle it?
    const [left, right] = await teamTallies(client, game.id)
    const decided = standing(left, right, game.win_margin).decided
    if (decided) await finishGame(client, game.id, 'margin')

    let next: ReturnType<typeof questionView> | null = null
    if (!decided) {
      const recent = nextRecent(s.recent_question_ids ?? [], s.current_question_id)
      const nextId = await pickQuestion(client, game, recent)
      await client.query(
        `update play_tug_player_state
            set current_question_id = $3, recent_question_ids = $4::uuid[],
                locked_until = case when $5::boolean then null else clock_timestamp() + make_interval(secs => $6::float8 / 1000) end
          where game_id = $1 and account_id = $2`,
        [game.id, accountId, nextId, recent, correct, STUMBLE_MS]
      )
      if (nextId) {
        const q = await client.query('select question_text, question_type, options from play_questions where id = $1', [nextId])
        next = questionView(q.rows[0])
      }
    }
    await client.query('commit')

    return NextResponse.json({
      correct,
      // A wrong answer shows the right one so the student learns from the stumble.
      correctAnswer: correct ? null : s.correct_answer,
      next,
      lockMs: correct || decided ? 0 : STUMBLE_MS,
      ended: decided,
    })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play tug answer failed', err)
    return NextResponse.json({ error: 'Something went wrong saving your answer.' }, { status: 500 })
  } finally {
    client.release()
  }
}
