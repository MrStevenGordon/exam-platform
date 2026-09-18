import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { getPlayAccountId } from '@/lib/playAuth'

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

    const game = await pool.query(`select id, status from play_live_games where code = $1 and status <> 'ended'`, [code])
    if (game.rows.length === 0) {
      await pool.query('insert into play_login_attempts (student_id, succeeded) values ($1, false)', [key])
      return NextResponse.json({ error: 'No game found with that code. Check it and try again.' }, { status: 404 })
    }

    // New players can only join in the lobby; players already in the game can
    // always rejoin (for example after their connection drops).
    const already = await pool.query('select 1 from play_live_players where game_id = $1 and account_id = $2', [game.rows[0].id, accountId])
    if (already.rows.length === 0 && game.rows[0].status !== 'lobby') {
      return NextResponse.json({ error: 'That game has already started. Ask your teacher to start a new one.' }, { status: 409 })
    }

    await pool.query('insert into play_live_players (game_id, account_id) values ($1, $2) on conflict do nothing', [game.rows[0].id, accountId])
    return NextResponse.json({ code })
  } catch (err) {
    console.error('Play live join failed', err)
    return NextResponse.json({ error: 'Something went wrong joining the game.' }, { status: 500 })
  }
}
