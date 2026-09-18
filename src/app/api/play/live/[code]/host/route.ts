import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayTeacherId } from '@/lib/playAuth'
import { effectivePhase, findGameByCode } from '@/lib/playLive'

const ACTIONS = ['start', 'skip', 'next', 'end']

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
  try {
    await client.query('begin')
    // Lock the game row so two quick clicks (or a double tap) cannot both advance it.
    const locked = await client.query(
      `select id from play_live_games where code = $1 and host_id = $2 and status <> 'ended' for update`,
      [code, teacherId]
    )
    if (locked.rows.length === 0) {
      await client.query('rollback')
      return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
    }
    const game = await findGameByCode(client, code)
    if (!game || game.id !== locked.rows[0].id) {
      await client.query('rollback')
      return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
    }
    const phase = await effectivePhase(client, game)

    if (action === 'start') {
      if (game.status !== 'lobby') { await client.query('rollback'); return NextResponse.json({ error: 'The game has already started.' }, { status: 409 }) }
      const players = await client.query('select count(*)::int as n from play_live_players where game_id = $1', [game.id])
      if (players.rows[0].n < 1) { await client.query('rollback'); return NextResponse.json({ error: 'Wait for at least one student to join.' }, { status: 409 }) }
      await client.query(`update play_live_games set status = 'question', current_index = 0, question_started_at = clock_timestamp() where id = $1`, [game.id])
    } else if (action === 'skip') {
      if (phase !== 'question') { await client.query('rollback'); return NextResponse.json({ error: 'There is no question running.' }, { status: 409 }) }
      await client.query(`update play_live_games set status = 'reveal' where id = $1`, [game.id])
    } else if (action === 'next') {
      if (phase !== 'reveal') { await client.query('rollback'); return NextResponse.json({ error: 'Show the answer before moving on.' }, { status: 409 }) }
      if (game.current_index + 1 >= game.question_count) {
        await client.query(`update play_live_games set status = 'ended', ended_at = now() where id = $1`, [game.id])
      } else {
        await client.query(
          `update play_live_games set status = 'question', current_index = current_index + 1, question_started_at = clock_timestamp() where id = $1`,
          [game.id]
        )
      }
    } else {
      await client.query(`update play_live_games set status = 'ended', ended_at = now() where id = $1`, [game.id])
    }
    await client.query('commit')
    return NextResponse.json({ ok: true })
  } catch (err) {
    await client.query('rollback').catch(() => {})
    console.error('Play live host action failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  } finally {
    client.release()
  }
}
