import { createClient } from '@supabase/supabase-js'

// Whether Smart Play is switched on for this school (school_settings.enabled_features.smart_play_enabled).
// Every Play page and API asks this on the server (see src/proxy.ts), so a school that has not been
// switched on gets "not found" for Play even if someone types an address. It fails closed: if the
// setting cannot be read, Play is off.
//
// The answer is remembered for a few seconds per server instance; live games poll about once a second
// and must not each cost a database read. Switching Play off therefore takes effect within that time.
const CACHE_MS = 15_000

let cached: { value: boolean; at: number } | null = null

export async function isPlayEnabled(): Promise<boolean> {
  // Local development only: lets Play run against a database whose school switch is still off.
  if (process.env.NODE_ENV !== 'production' && process.env.PLAY_FORCE_ENABLED === '1') return true

  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!)
    const { data, error } = await admin.from('school_settings').select('enabled_features').limit(1).maybeSingle()
    if (error) return false
    const value = (data?.enabled_features as { smart_play_enabled?: boolean } | null)?.smart_play_enabled === true
    cached = { value, at: Date.now() }
    return value
  } catch {
    return false
  }
}

// Used by tests.
export function resetPlayEnabledCache() {
  cached = null
}

// Play's own pages and APIs. Nothing else in the app is affected by the switch.
export function isPlayPath(pathname: string): boolean {
  return pathname === '/play' || pathname.startsWith('/play/') || pathname === '/api/play' || pathname.startsWith('/api/play/')
}
