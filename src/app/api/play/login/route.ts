import { NextResponse } from 'next/server'
import { getPlayPool } from '@/lib/playDb'
import { PLAY_COOKIE, createPlayToken } from '@/lib/playSession'

const BAD_LOGIN = 'ID# or game password is incorrect.'

export async function POST(request: Request) {
  // Game passwords are retired: Smart Play signs in through the exam login (/api/play/sso). This route only
  // exists for local development, behind PLAY_GAME_PASSWORD_LOGIN=1.
  if (process.env.PLAY_GAME_PASSWORD_LOGIN !== '1') return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const studentId = typeof body?.studentId === 'string' ? body.studentId.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!studentId || !password || studentId.length > 32 || password.length > 128) {
    return NextResponse.json({ error: BAD_LOGIN }, { status: 400 })
  }

  try {
    const pool = getPlayPool()

    const locked = await pool.query('select play_login_locked($1) as locked', [studentId])
    if (locked.rows[0].locked) {
      return NextResponse.json(
        { error: 'Too many wrong attempts. Please wait 10 minutes and try again.' },
        { status: 429, headers: { 'Retry-After': '600' } }
      )
    }

    const result = await pool.query('select * from play_verify_login($1, $2)', [studentId, password])
    const account = result.rows[0]

    await pool.query('insert into play_login_attempts (student_id, succeeded) values ($1, $2)', [studentId, !!account])
    if (!account) return NextResponse.json({ error: BAD_LOGIN }, { status: 401 })

    await pool.query('update play_accounts set last_login_at = now() where id = $1', [account.id])

    const { token, maxAge } = createPlayToken(account.id)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(PLAY_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    })
    return response
  } catch (err) {
    console.error('Play login failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
