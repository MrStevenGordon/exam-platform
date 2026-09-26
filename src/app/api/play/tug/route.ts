import { NextResponse } from 'next/server'
import { randomInt } from 'node:crypto'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'
import { CODE_LOCK_KEY, codeInUseByOpenGame } from '@/lib/playBoard'
import { TUG_LIVE_TYPES } from '@/lib/playTug'

const ALLOWED_SECONDS = [60, 120, 180, 300]
const ALLOWED_MARGINS = [3, 5, 8]
const MIN_QUESTIONS = 6
const MAX_TEAM_NAME = 20

export async function GET() {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const { rows } = await getPlayPool().query(
      `select g.code, g.subject, g.topic, g.status, g.created_at,
              (select count(*)::int from play_tug_players p where p.game_id = g.id) as players
         from play_tug_games g where g.host_id = $1 order by g.created_at desc limit 10`,
      [teacherId]
    )
    return NextResponse.json({ games: rows })
  } catch (err) {
    console.error('Play tug list failed', err)
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
  const durationSeconds = Number(body?.durationSeconds)
  const winMargin = Number(body?.winMargin)
  if (!subject || subject.length > 100 || (topic && topic.length > 100) || !ALLOWED_SECONDS.includes(durationSeconds) || !ALLOWED_MARGINS.includes(winMargin)) {
    return NextResponse.json({ error: 'Pick a subject, a time limit and how big a lead wins.' }, { status: 400 })
  }
  const names: string[] = Array.isArray(body?.teamNames) ? body.teamNames.map((n: unknown) => (typeof n === 'string' ? n.replace(/\s+/g, ' ').trim() : '')) : []
  if (names.length !== 2 || names.some((n) => !n || n.length > MAX_TEAM_NAME)) {
    return NextResponse.json({ error: `Name both teams (up to ${MAX_TEAM_NAME} characters each).` }, { status: 400 })
  }
  if (names[0].toLowerCase() === names[1].toLowerCase()) return NextResponse.json({ error: 'The two teams need different names.' }, { status: 400 })

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    await client.query('select pg_advisory_xact_lock($1)', [CODE_LOCK_KEY])

    const pool = await client.query(
      `select count(*)::int as n from play_questions
        where status = 'approved' and subject = $1 and ($2::text is null or topic = $2) and question_type = any($3)`,
      [subject, topic, TUG_LIVE_TYPES]
    )
    if (pool.rows[0].n < MIN_QUESTIONS) {
      await client.query('rollback')
      return NextResponse.json({ error: `Tug of War needs at least ${MIN_QUESTIONS} tap-to-answer questions and that choice has ${pool.rows[0].n}. Pick a wider topic or add questions.` }, { status: 400 })
    }

    await client.query(`update play_live_games set status = 'ended', ended_at = now() where host_id = $1 and status <> 'ended'`, [teacherId])
    await client.query(`update play_board_games set status = 'ended', ended_at = now() where host_id = $1 and status <> 'ended'`, [teacherId])
    await client.query(`update play_tug_games set status = 'ended', ended_at = now(), end_reason = 'host' where host_id = $1 and status <> 'ended'`, [teacherId])

    let code = ''
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = String(randomInt(0, 1_000_000)).padStart(6, '0')
      if (!(await codeInUseByOpenGame(client, candidate))) { code = candidate; break }
    }
    if (!code) throw new Error('Could not allocate a join code')

    const game = await client.query(
      `insert into play_tug_games (code, host_id, subject, topic, duration_seconds, win_margin) values ($1, $2, $3, $4, $5, $6) returning id`,
      [code, teacherId, subject, topic, durationSeconds, winMargin]
    )
    for (let i = 0; i < 2; i++) await client.query('insert into play_tug_teams (game_id, position, name) values ($1, $2, $3)', [game.rows[0].id, i, names[i]])
    await client.query('commit')
    return NextResponse.json({ code })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play tug create failed', err)
    return NextResponse.json({ error: 'Something went wrong creating the game.' }, { status: 500 })
  } finally {
    client.release()
  }
}
