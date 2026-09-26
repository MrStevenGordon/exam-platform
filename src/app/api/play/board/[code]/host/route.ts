import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId, UUID_RE } from '@/lib/playAuth'
import { boardPhase, findBoardByCode, invalidateBoardState } from '@/lib/playBoard'

const ACTIONS = ['start', 'open', 'correct', 'wrong', 'reveal', 'board', 'end', 'shuffle', 'move']

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
    // Locking the row makes a double click or a simultaneous buzz safe: every
    // change below happens against a stable view of the game.
    const locked = await client.query(`select id from play_board_games where code = $1 and host_id = $2 and status <> 'ended' for update`, [code, teacherId])
    const game = locked.rows.length > 0 ? await findBoardByCode(client, code) : null
    if (!game || game.id !== locked.rows[0].id) return await fail(404, 'Game not found.')
    const phase = boardPhase(game)

    if (action === 'shuffle' || action === 'move') {
      if (!game.team_mode) return await fail(409, 'This game is not played in teams.')
      if (game.status !== 'lobby') return await fail(409, 'Teams can only be changed before the game starts.')
      if (action === 'shuffle') {
        // Deal players round-robin in random order across the teams, so the sizes differ by at most one.
        await client.query(
          `with ordered as (
             select account_id, row_number() over (order by random()) as rn from play_board_players where game_id = $1
           ), t as (
             select id, row_number() over (order by position) - 1 as pos, count(*) over () as cnt from play_board_teams where game_id = $1
           )
           update play_board_players p set team_id = t.id
             from ordered o join t on t.pos = ((o.rn - 1) % t.cnt)
            where p.game_id = $1 and p.account_id = o.account_id`,
          [game.id]
        )
      } else {
        const playerId = typeof body?.playerId === 'string' ? body.playerId : ''
        const teamId = typeof body?.teamId === 'string' ? body.teamId : ''
        if (!UUID_RE.test(playerId) || !UUID_RE.test(teamId)) return await fail(400, 'Pick a student and a team.')
        const moved = await client.query(
          `update play_board_players set team_id = $3
            where game_id = $1 and account_id = $2
              and exists (select 1 from play_board_teams where id = $3 and game_id = $1)`,
          [game.id, playerId, teamId]
        )
        if (moved.rowCount === 0) return await fail(404, 'That student or team is not in this game.')
      }
    } else if (action === 'start') {
      if (game.status !== 'lobby') return await fail(409, 'The game has already started.')
      const n = await client.query('select count(*)::int as n from play_board_players where game_id = $1', [game.id])
      if (n.rows[0].n < 1) return await fail(409, 'Wait for at least one student to join.')
      await client.query(`update play_board_games set status = 'board' where id = $1`, [game.id])
    } else if (action === 'open') {
      const clueId = typeof body?.clueId === 'string' ? body.clueId : ''
      if (!UUID_RE.test(clueId)) return await fail(400, 'Pick a clue on the board.')
      if (phase !== 'board') return await fail(409, 'Finish the current clue first.')
      const clue = await client.query('select used from play_board_clues where id = $1 and game_id = $2', [clueId, game.id])
      if (clue.rows.length === 0) return await fail(404, 'That clue is not on this board.')
      if (clue.rows[0].used) return await fail(409, 'That clue has already been played.')
      await client.query(`update play_board_games set status = 'clue', current_clue_id = $2, clue_opened_at = clock_timestamp() where id = $1`, [game.id, clueId])
    } else if (action === 'correct' || action === 'wrong') {
      if (game.status !== 'answering' || !game.current_clue_id) return await fail(409, 'No one is answering right now.')
      const judged = await client.query(
        `update play_board_buzzes set outcome = $3 where clue_id = $1 and outcome = 'pending' and game_id = $2 returning account_id`,
        [game.current_clue_id, game.id, action]
      )
      if (judged.rowCount === 0) return await fail(409, 'No one is answering right now.')
      if (action === 'correct') {
        await client.query(`update play_board_games set status = 'reveal' where id = $1`, [game.id])
      } else {
        // Wrong: reopen for everyone who has not tried yet; if nobody is left, show the answer.
        // Individual game: players who have not tried. Team game: teams that have
        // players and have not tried (a team gets one attempt per clue).
        const left = game.team_mode
          ? await client.query(
              `select count(*)::int as n from play_board_teams t
                where t.game_id = $1
                  and exists (select 1 from play_board_players p where p.team_id = t.id)
                  and not exists (select 1 from play_board_buzzes b where b.clue_id = $2 and b.team_id = t.id)`,
              [game.id, game.current_clue_id]
            )
          : await client.query(
              `select count(*)::int as n from play_board_players p
                where p.game_id = $1 and not exists (select 1 from play_board_buzzes b where b.clue_id = $2 and b.account_id = p.account_id)`,
              [game.id, game.current_clue_id]
            )
        if (left.rows[0].n > 0) await client.query(`update play_board_games set status = 'clue', clue_opened_at = clock_timestamp() where id = $1`, [game.id])
        else await client.query(`update play_board_games set status = 'reveal' where id = $1`, [game.id])
      }
    } else if (action === 'reveal') {
      if (phase !== 'clue') return await fail(409, 'There is no open clue to give up on.')
      await client.query(`update play_board_games set status = 'reveal' where id = $1`, [game.id])
    } else if (action === 'board') {
      if (phase !== 'reveal') return await fail(409, 'Show the answer before going back to the board.')
      await client.query('update play_board_clues set used = true where id = $1', [game.current_clue_id])
      const remaining = await client.query('select count(*)::int as n from play_board_clues where game_id = $1 and not used', [game.id])
      if (remaining.rows[0].n === 0) await client.query(`update play_board_games set status = 'ended', ended_at = now(), current_clue_id = null where id = $1`, [game.id])
      else await client.query(`update play_board_games set status = 'board', current_clue_id = null, clue_opened_at = null where id = $1`, [game.id])
    } else {
      await client.query(`update play_board_games set status = 'ended', ended_at = now() where id = $1`, [game.id])
    }
    await client.query('commit')
    invalidateBoardState(code)
    return NextResponse.json({ ok: true })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play board host action failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  } finally {
    client.release()
  }
}
