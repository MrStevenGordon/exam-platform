import { NextResponse } from 'next/server'
import { randomInt } from 'node:crypto'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'
import { CODE_LOCK_KEY, codeInUseByOpenGame } from '@/lib/playBoard'

const ALLOWED_ROWS = [3, 4, 5]
const ALLOWED_BUZZ_SECONDS = [10, 20, 30, 45]
const MIN_CATEGORIES = 2
const MAX_CATEGORIES = 6
const MIN_TEAMS = 2
const MAX_TEAMS = 6
const MAX_TEAM_NAME = 24

export async function GET() {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  try {
    const { rows } = await getPlayPool().query(
      `select g.code, g.subject, g.status, g.created_at,
              (select count(*)::int from play_board_players p where p.game_id = g.id) as players
         from play_board_games g where g.host_id = $1 order by g.created_at desc limit 10`,
      [teacherId]
    )
    return NextResponse.json({ games: rows })
  } catch (err) {
    console.error('Play board list failed', err)
    return NextResponse.json({ error: 'Something went wrong loading your boards.' }, { status: 500 })
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
  const rowsPer = Number(body?.rows)
  const buzzSeconds = Number(body?.buzzSeconds)
  const deductWrong = body?.deductWrong === true
  const topics: string[] = Array.isArray(body?.topics) ? body.topics.filter((t: unknown): t is string => typeof t === 'string') : []
  const distinct = Array.from(new Set(topics))
  if (!subject || subject.length > 100 || !ALLOWED_ROWS.includes(rowsPer) || !ALLOWED_BUZZ_SECONDS.includes(buzzSeconds)) {
    return NextResponse.json({ error: 'Pick a subject, the number of rows and a buzz time.' }, { status: 400 })
  }
  // Optional team mode: 2-6 distinct team names.
  let teamNames: string[] | null = null
  if (body?.teamNames !== undefined && body?.teamNames !== null) {
    if (!Array.isArray(body.teamNames)) return NextResponse.json({ error: 'Team names must be a list.' }, { status: 400 })
    teamNames = body.teamNames.map((n: unknown) => (typeof n === 'string' ? n.replace(/\s+/g, ' ').trim() : ''))
    const names = teamNames as string[]
    if (names.length < MIN_TEAMS || names.length > MAX_TEAMS) return NextResponse.json({ error: `Use between ${MIN_TEAMS} and ${MAX_TEAMS} teams.` }, { status: 400 })
    if (names.some((n) => !n || n.length > MAX_TEAM_NAME)) return NextResponse.json({ error: `Give every team a name of up to ${MAX_TEAM_NAME} characters.` }, { status: 400 })
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return NextResponse.json({ error: 'Team names must all be different.' }, { status: 400 })
  }
  if (distinct.length !== topics.length || distinct.length < MIN_CATEGORIES || distinct.length > MAX_CATEGORIES || distinct.some((t) => !t || t.length > 100)) {
    return NextResponse.json({ error: `Choose between ${MIN_CATEGORIES} and ${MAX_CATEGORIES} different categories.` }, { status: 400 })
  }

  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    await client.query('select pg_advisory_xact_lock($1)', [CODE_LOCK_KEY])

    // Each category needs enough approved questions to fill its column. Pick a
    // random set per category, then order easiest to hardest by points so the
    // bigger values tend to carry the harder clues.
    const columns: { id: string }[][] = []
    for (const topic of distinct) {
      const picked = await client.query(
        `select id from (
           select id, points from play_questions where status = 'approved' and subject = $1 and topic = $2 order by random() limit $3
         ) t order by points asc, random()`,
        [subject, topic, rowsPer]
      )
      if (picked.rows.length < rowsPer) {
        await client.query('rollback')
        return NextResponse.json({ error: `"${topic}" only has ${picked.rows.length} approved question${picked.rows.length !== 1 ? 's' : ''}, but ${rowsPer} rows need ${rowsPer}. Choose fewer rows or add questions.` }, { status: 400 })
      }
      columns.push(picked.rows)
    }

    // Starting a board closes this teacher's other unfinished games.
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
      `insert into play_board_games (code, host_id, subject, rows_per_category, deduct_wrong, buzz_seconds, team_mode)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [code, teacherId, subject, rowsPer, deductWrong, buzzSeconds, teamNames !== null]
    )
    const gameId = game.rows[0].id
    if (teamNames) {
      for (let i = 0; i < teamNames.length; i++) {
        await client.query('insert into play_board_teams (game_id, position, name) values ($1, $2, $3)', [gameId, i, teamNames[i]])
      }
    }

    for (let c = 0; c < distinct.length; c++) {
      await client.query('insert into play_board_categories (game_id, position, topic) values ($1, $2, $3)', [gameId, c, distinct[c]])
      for (let r = 0; r < rowsPer; r++) {
        await client.query(
          'insert into play_board_clues (game_id, category_position, row_position, value, question_id) values ($1, $2, $3, $4, $5)',
          [gameId, c, r, (r + 1) * 100, columns[c][r].id]
        )
      }
    }
    await client.query('commit')
    return NextResponse.json({ code })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play board create failed', err)
    return NextResponse.json({ error: 'Something went wrong creating the board.' }, { status: 500 })
  } finally {
    client.release()
  }
}
