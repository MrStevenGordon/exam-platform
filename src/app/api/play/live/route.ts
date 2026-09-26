import { NextResponse } from 'next/server'
import { randomInt } from 'node:crypto'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'
import { CODE_LOCK_KEY, codeInUseByOpenGame } from '@/lib/playBoard'

const ALLOWED_COUNTS = [5, 10, 15]
const ALLOWED_SECONDS = [10, 20, 30, 45]
const MIN_QUESTIONS = 3

// Live games use tap-to-answer questions only (multiple choice / true-false).
const LIVE_TYPES = ['multiple_choice', 'true_false']

export async function GET() {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const { rows } = await getPlayPool().query(
      `select g.code, g.subject, g.topic, g.status, g.question_count, g.created_at,
              (select count(*)::int from play_live_players p where p.game_id = g.id) as players
         from play_live_games g
        where g.host_id = $1
        order by g.created_at desc
        limit 10`,
      [teacherId]
    )
    return NextResponse.json({ games: rows })
  } catch (err) {
    console.error('Play live list failed', err)
    return NextResponse.json({ error: 'Something went wrong loading your games.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const subject = typeof body?.subject === 'string' ? body.subject : ''
  const topic = typeof body?.topic === 'string' && body.topic ? body.topic : null
  const questionCount = Number(body?.questionCount)
  const seconds = Number(body?.secondsPerQuestion)
  if (!subject || subject.length > 100 || (topic && topic.length > 100) || !ALLOWED_COUNTS.includes(questionCount) || !ALLOWED_SECONDS.includes(seconds)) {
    return NextResponse.json({ error: 'Pick a subject, number of questions and time per question.' }, { status: 400 })
  }

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    await client.query('select pg_advisory_xact_lock($1)', [CODE_LOCK_KEY])
    const picked = await client.query(
      `select id from play_questions
        where status = 'approved' and subject = $1 and ($2::text is null or topic = $2) and question_type = any($3)
        order by random() limit $4`,
      [subject, topic, LIVE_TYPES, questionCount]
    )
    if (picked.rows.length < MIN_QUESTIONS) {
      await client.query('rollback')
      return NextResponse.json({ error: 'There are not enough tap-to-answer questions for that choice yet. Try another topic.' }, { status: 400 })
    }

    // Starting a new game closes any of this teacher's unfinished ones, so a
    // stale join code never lingers.
    await client.query(`update play_live_games set status = 'ended', ended_at = now() where host_id = $1 and status <> 'ended'`, [teacherId])
    await client.query(`update play_board_games set status = 'ended', ended_at = now() where host_id = $1 and status <> 'ended'`, [teacherId])
    await client.query(`update play_tug_games set status = 'ended', ended_at = now(), end_reason = 'host' where host_id = $1 and status <> 'ended'`, [teacherId])

    let gameId: string | null = null
    let code = ''
    for (let attempt = 0; attempt < 10 && !gameId; attempt++) {
      code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      if (await codeInUseByOpenGame(client, code)) continue
      await client.query('savepoint code_try')
      try {
        const res = await client.query(
          `insert into play_live_games (code, host_id, subject, topic, question_count, seconds_per_question)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [code, teacherId, subject, topic, picked.rows.length, seconds]
        )
        gameId = res.rows[0].id
      } catch (err: any) {
        if (err?.code !== '23505') throw err
        await client.query('rollback to savepoint code_try')
      }
    }
    if (!gameId) throw new Error('Could not allocate a join code')

    await client.query(
      `insert into play_live_questions (game_id, question_id, order_index)
       select $1, q.id, q.ord - 1 from unnest($2::uuid[]) with ordinality as q(id, ord)`,
      [gameId, picked.rows.map((r) => r.id)]
    )
    await client.query('commit')
    return NextResponse.json({ code })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play live create failed', err)
    return NextResponse.json({ error: 'Something went wrong creating the game.' }, { status: 500 })
  } finally {
    client.release()
  }
}
