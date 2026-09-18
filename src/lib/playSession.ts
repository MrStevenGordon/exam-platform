import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const PLAY_COOKIE = 'play_session'
const SESSION_SECONDS = 60 * 60 * 12

type PlaySessionPayload = { sub: string; exp: number }

function secret(): string {
  const s = process.env.PLAY_SESSION_SECRET
  if (!s || s.length < 32) throw new Error('PLAY_SESSION_SECRET must be set to at least 32 characters')
  return s
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function createPlayToken(accountId: string): { token: string; maxAge: number } {
  const payload: PlaySessionPayload = { sub: accountId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { token: `${body}.${sign(body)}`, maxAge: SESSION_SECONDS }
}

export function verifyPlayToken(token: string | undefined): PlaySessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as PlaySessionPayload
    if (typeof payload.sub !== 'string' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function getPlaySession(): Promise<PlaySessionPayload | null> {
  const store = await cookies()
  return verifyPlayToken(store.get(PLAY_COOKIE)?.value)
}
