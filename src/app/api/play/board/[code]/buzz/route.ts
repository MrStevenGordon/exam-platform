import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'
import { BOARD_GRACE_MS, findBoardByCode } from '@/lib/playBoard'

// A student buzzes in. The game row is locked for the whole check-and-write, so
// two near-simultaneous buzzes are ordered by the database and exactly one
// wins; the loser is told someone was faster. The order is the server's, not
// the browsers', so a fast device clock buys nothing.
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { code } = await params
  const client = await getPlayPool().connect()
  try {
    await client.query('begin')
    const locked = await client.query(`select id from play_board_games where code = $1 and status <> 'ended' for update`, [code])
    const game = locked.rows.length > 0 ? await findBoardByCode(client, code) : null
    if (!game || game.id !== locked.rows[0].id) { await client.query('rollback'); return NextResponse.json({ error: 'Game not found.' }, { status: 404 }) }

    const joined = await client.query('select team_id from play_board_players where game_id = $1 and account_id = $2', [game.id, accountId])
    if (joined.rows.length === 0) { await client.query('rollback'); return NextResponse.json({ error: 'Game not found.' }, { status: 404 }) }
    const teamId: string | null = game.team_mode ? joined.rows[0].team_id : null
    if (game.team_mode && !teamId) { await client.query('rollback'); return NextResponse.json({ error: 'You are not on a team yet. Ask your teacher.' }, { status: 409 }) }

    if (game.status === 'answering') { await client.query('rollback'); return NextResponse.json({ error: 'Someone else buzzed in first.' }, { status: 409 }) }
    if (game.status !== 'clue' || !game.current_clue_id || (game.elapsed_ms ?? 0) > game.buzz_seconds * 1000 + BOARD_GRACE_MS) {
      await client.query('rollback')
      return NextResponse.json({ error: 'You can only buzz in while a clue is open.' }, { status: 409 })
    }

    // One attempt per clue: per player in an individual game, per team in a team game.
    const existing = teamId
      ? await client.query('select 1 from play_board_buzzes where clue_id = $1 and team_id = $2', [game.current_clue_id, teamId])
      : await client.query('select 1 from play_board_buzzes where clue_id = $1 and account_id = $2', [game.current_clue_id, accountId])
    if (existing.rows.length > 0) {
      await client.query('rollback')
      return NextResponse.json({ error: teamId ? 'Your team already tried this clue.' : 'You already buzzed on this clue.' }, { status: 409 })
    }

    await client.query('insert into play_board_buzzes (clue_id, game_id, account_id, team_id) values ($1, $2, $3, $4)', [game.current_clue_id, game.id, accountId, teamId])
    await client.query(`update play_board_games set status = 'answering' where id = $1`, [game.id])
    await client.query('commit')
    return NextResponse.json({ ok: true })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play board buzz failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  } finally {
    client.release()
  }
}
