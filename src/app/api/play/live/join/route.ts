import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'
import { leastFullTeamId } from '@/lib/playBoard'
import { leastFullTugTeamId } from '@/lib/playTug'

const MAX_BAD_CODES = 10

export async function POST(request: Request) {
  const accountId = await getPlayAccountId()
  if (!accountId) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : ''
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the 6-digit code from your teacher.' }, { status: 400 })

  try {
    const pool = getPlayPool()

    // Join codes are only 6 digits, so guessing is throttled per account.
    const key = `join:${accountId}`
    const bad = await pool.query(
      `select count(*)::int as n from play_login_attempts where student_id = $1 and not succeeded and attempted_at > now() - interval '10 minutes'`,
      [key]
    )
    if (bad.rows[0].n >= MAX_BAD_CODES) {
      return NextResponse.json({ error: 'Too many wrong codes. Please wait a few minutes and try again.' }, { status: 429, headers: { 'Retry-After': '600' } })
    }

    // A code identifies one open game, either a live quiz or a Jeopardy board.
    let kind: 'quiz' | 'board' | 'tug' = 'quiz'
    let game = (await pool.query(`select id, status from play_live_games where code = $1 and status <> 'ended'`, [code])).rows[0]
    if (!game) {
      game = (await pool.query(`select id, status from play_board_games where code = $1 and status <> 'ended'`, [code])).rows[0]
      kind = 'board'
    }
    if (!game) {
      game = (await pool.query(`select id, status from play_tug_games where code = $1 and status <> 'ended'`, [code])).rows[0]
      kind = 'tug'
    }
    if (!game) {
      await pool.query('insert into play_login_attempts (student_id, succeeded) values ($1, false)', [key])
      return NextResponse.json({ error: 'No game found with that code. Check it and try again.' }, { status: 404 })
    }

    if (kind === 'board') {
      // Locking the game row makes simultaneous joins take turns, so team
      // sizes stay balanced no matter how many students arrive at once.
      const client = await pool.connect()
      try {
        await client.query('begin')
        const g = (await client.query('select status, team_mode from play_board_games where id = $1 for update', [game.id])).rows[0]
        if (!g || g.status === 'ended') {
          await client.query('rollback')
          return NextResponse.json({ error: 'No game found with that code. Check it and try again.' }, { status: 404 })
        }
        const already = await client.query('select 1 from play_board_players where game_id = $1 and account_id = $2', [game.id, accountId])
        if (already.rows.length === 0) {
          if (g.status !== 'lobby') {
            await client.query('rollback')
            return NextResponse.json({ error: 'That game has already started. Ask your teacher to start a new one.' }, { status: 409 })
          }
          const teamId = g.team_mode ? await leastFullTeamId(client, game.id) : null
          await client.query('insert into play_board_players (game_id, account_id, team_id) values ($1, $2, $3) on conflict do nothing', [game.id, accountId, teamId])
        }
        await client.query('commit')
        return NextResponse.json({ code, kind })
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }

    if (kind === 'tug') {
      // Same idea as boards: a row lock keeps the two sides balanced when many
      // students join at once. Joining is only possible before the game starts.
      const client = await pool.connect()
      try {
        await client.query('begin')
        const g = (await client.query('select status from play_tug_games where id = $1 for update', [game.id])).rows[0]
        if (!g || g.status === 'ended') {
          await client.query('rollback')
          return NextResponse.json({ error: 'No game found with that code. Check it and try again.' }, { status: 404 })
        }
        const already = await client.query('select 1 from play_tug_players where game_id = $1 and account_id = $2', [game.id, accountId])
        if (already.rows.length === 0) {
          if (g.status !== 'lobby') {
            await client.query('rollback')
            return NextResponse.json({ error: 'That game has already started. Ask your teacher to start a new one.' }, { status: 409 })
          }
          const teamId = await leastFullTugTeamId(client, game.id)
          await client.query('insert into play_tug_players (game_id, account_id, team_id) values ($1, $2, $3) on conflict do nothing', [game.id, accountId, teamId])
        }
        await client.query('commit')
        return NextResponse.json({ code, kind })
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }

    const playersTable = 'play_live_players'

    // New players can only join in the lobby; players already in the game can
    // always rejoin (for example after their connection drops).
    const already = await pool.query(`select 1 from ${playersTable} where game_id = $1 and account_id = $2`, [game.id, accountId])
    if (already.rows.length === 0 && game.status !== 'lobby') {
      return NextResponse.json({ error: 'That game has already started. Ask your teacher to start a new one.' }, { status: 409 })
    }

    await pool.query(`insert into ${playersTable} (game_id, account_id) values ($1, $2) on conflict do nothing`, [game.id, accountId])
    return NextResponse.json({ code, kind })
  } catch (err) {
    console.error('Play live join failed', err)
    return NextResponse.json({ error: 'Something went wrong joining the game.' }, { status: 500 })
  }
}
