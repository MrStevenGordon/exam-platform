import { NextResponse } from 'next/server'
import { PLAY_COOKIE } from '@/lib/playSession'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(PLAY_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}
