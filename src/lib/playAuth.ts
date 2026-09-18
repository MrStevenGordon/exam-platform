import { getPlayPool } from '@/lib/playDb'
import { getPlaySession } from '@/lib/playSession'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Returns the signed-in, still-active game account id, or null. API routes
// use this so a deactivated account stops working before its cookie expires.
export async function getPlayAccountId(): Promise<string | null> {
  const session = await getPlaySession()
  if (!session || !UUID_RE.test(session.sub)) return null
  const { rows } = await getPlayPool().query('select id from play_accounts where id = $1 and is_active', [session.sub])
  return rows[0]?.id ?? null
}
