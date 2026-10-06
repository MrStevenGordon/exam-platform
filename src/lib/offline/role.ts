import { supabase } from '@/lib/supabase'
import { currentUserId } from '@/lib/offline/flashcardsOffline'
import { idbKv } from '@/lib/offline/kv'
import { browserOffline, isNetworkFailure } from '@/lib/offline/network'
import { getRole, saveRole } from '@/lib/offline/offlineCache'

// Who is this, and what are they? Online it is asked of the server (and remembered). Without a connection it is the person last signed in
// on this device and the role remembered for them, so the lessons area can open from the copy on the device. Null means "not signed in".
export async function resolveRole(): Promise<{ userId: string; role: string; fromCache: boolean } | null> {
  const kv = idbKv()
  if (!browserOffline()) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role) { if (kv) await saveRole(kv, user.id, profile.role as string); return { userId: user.id, role: profile.role as string, fromCache: false } }
        if (error && !isNetworkFailure(error)) return null
      } else if (userError && !isNetworkFailure(userError)) return null
      else if (!userError) return null
    } catch { /* network trouble: use the copy on the device below */ }
  }
  const uid = await currentUserId()
  if (!uid || !kv) return null
  const role = await getRole(kv, uid)
  return role ? { userId: uid, role, fromCache: true } : null
}
