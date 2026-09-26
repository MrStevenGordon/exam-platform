import { getPlayPool } from '@/lib/playDb'
import { getPlaySession } from '@/lib/playSession'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PlayRole = 'student' | 'teacher'

// A signed-in account is remembered for a short time per server instance, so the many polls of a live
// game do not each check the database. Someone deactivated therefore stops working within this time
// (and their exam sign-in is refused straight away).
const ACCOUNT_CACHE_MS = 30_000
const accountCache = new Map<string, { at: number; value: { id: string; role: PlayRole; displayName: string } }>()

// Returns the signed-in, still-active game account, or null. API routes use
// this so a deactivated account stops working before its cookie expires.
export async function getPlayAccount(): Promise<{ id: string; role: PlayRole; displayName: string } | null> {
  const session = await getPlaySession()
  if (!session || !UUID_RE.test(session.sub)) return null
  const hit = accountCache.get(session.sub)
  if (hit && Date.now() - hit.at < ACCOUNT_CACHE_MS) return hit.value
  const { rows } = await getPlayPool().query('select id, role, display_name from play_accounts where id = $1 and is_active', [session.sub])
  if (!rows[0]) { accountCache.delete(session.sub); return null }
  const value = { id: rows[0].id as string, role: rows[0].role as PlayRole, displayName: rows[0].display_name as string }
  accountCache.set(session.sub, { at: Date.now(), value })
  if (accountCache.size > 2000) for (const [k, v] of accountCache) if (Date.now() - v.at > ACCOUNT_CACHE_MS) accountCache.delete(k)
  return value
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
