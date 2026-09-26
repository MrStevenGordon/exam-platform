import { getPlayPool } from '@/lib/playDb'
import { getPlaySession } from '@/lib/playSession'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PlayRole = 'student' | 'teacher'

// Returns the signed-in, still-active game account, or null. API routes use
// this so a deactivated account stops working before its cookie expires.
export async function getPlayAccount(): Promise<{ id: string; role: PlayRole; displayName: string } | null> {
  const session = await getPlaySession()
  if (!session || !UUID_RE.test(session.sub)) return null
  const { rows } = await getPlayPool().query('select id, role, display_name from play_accounts where id = $1 and is_active', [session.sub])
  return rows[0] ? { id: rows[0].id, role: rows[0].role, displayName: rows[0].display_name } : null
}

// Student-only routes (Topic Mastery, Math Duels, joining a live game).
export async function getPlayAccountId(): Promise<string | null> {
  const account = await getPlayAccount()
  return account?.role === 'student' ? account.id : null
}

// Teacher-only routes (hosting live games).
export async function getPlayTeacherId(): Promise<string | null> {
  const account = await getPlayAccount()
  return account?.role === 'teacher' ? account.id : null
}
