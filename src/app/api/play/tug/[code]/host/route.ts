import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId, UUID_RE } from '@/lib/playAuth'
import { findTugByCode, finishGame, pickQuestion } from '@/lib/playTug'

const ACTIONS = ['start', 'end', 'shuffle', 'move']

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const teacherId = await getPlayTeacherId()
  if (!teacherId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { code } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const action = typeof body?.action === 'string' ? body.action : ''
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })

  const client = await getPlayPool().connect()
  const fail = async (status: number, error: string) => { await client.query('rollback'); return NextResponse.json({ error }, { status }) }
  try {
    await client.query('begin')
    const locked = await client.query(`select id from play_tug_games where code = $1 and host_id = $2 and status <> 'ended' for update`, [code, teacherId])
    const game = locked.rows.length > 0 ? await findTugByCode(client, code) : null
    if (!game || game.id !== locked.rows[0].id) return await fail(404, 'Game not found.')

    if (action === 'shuffle' || action === 'move') {
      if (game.status !== 'lobby') return await fail(409, 'Teams can only be changed before the game starts.')
      if (action === 'shuffle') {
        await client.query(
          `with ordered as (
             select account_id, row_number() over (order by random()) as rn from play_tug_players where game_id = $1
           ), t as (
             select id, row_number() over (order by position) - 1 as pos from play_tug_teams where game_id = $1
           )
           update play_tug_players p set team_id = t.id
             from ordered o join t on t.pos = ((o.rn - 1) % 2)
            where p.game_id = $1 and p.account_id = o.account_id`,
          [game.id]
        )
      } else {
        const playerId = typeof body?.playerId === 'string' ? body.playerId : ''
        const teamId = typeof body?.teamId === 'string' ? body.teamId : ''
        if (!UUID_RE.test(playerId) || !UUID_RE.test(teamId)) return await fail(400, 'Pick a student and a team.')
        const moved = await client.query(
          `update play_tug_players set team_id = $3
            where game_id = $1 and account_id = $2 and exists (select 1 from play_tug_teams where id = $3 and game_id = $1)`,
          [game.id, playerId, teamId]
        )
        if (moved.rowCount === 0) return await fail(404, 'That student or team is not in this game.')
      }
    } else if (action === 'start') {
      if (game.status !== 'lobby') return await fail(409, 'The game has already started.')
      const sizes = await client.query(
        `select t.position, (select count(*)::int from play_tug_players p where p.team_id = t.id) as n from play_tug_teams t where t.game_id = $1 order by t.position`,
        [game.id]
      )
      if (sizes.rows.some((r) => r.n < 1)) return await fail(409, 'Each team needs at least one player before you start.')

      // Everyone gets their own first question the moment the clock starts.
      const players = await client.query('select account_id from play_tug_players where game_id = $1', [game.id])
      for (const p of players.rows) {
        const qid = await pickQuestion(client, game, [])
        if (!qid) return await fail(409, 'There are no questions available for this game.')
        await client.query(
          `insert into play_tug_player_state (game_id, account_id, current_question_id) values ($1, $2, $3)
           on conflict (game_id, account_id) do update set current_question_id = excluded.current_question_id, recent_question_ids = '{}', locked_until = null`,
          [game.id, p.account_id, qid]
        )
      }
      await client.query(`update play_tug_games set status = 'running', started_at = clock_timestamp() where id = $1`, [game.id])
    } else {
      await finishGame(client, game.id, 'host')
    }
    await client.query('commit')
    return NextResponse.json({ ok: true })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play tug host action failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  } finally {
    client.release()
  }
}
