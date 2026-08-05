import { supabase } from '@/lib/supabase'

// Releases a student's single-device login lock so they can log in
// elsewhere afterward. Called on explicit logout and on inactivity
// auto-logout — without this, signing out on one device would leave the
// student permanently locked out of every other device until an admin
// intervenes, which isn't the intent (the lock is meant to stop two
// *simultaneous* sessions, not to bind a student to one device forever).
export async function releaseDeviceLock(userId: string) {
  await supabase.from('profiles').update({
    active_login_token: null,
    active_login_started_at: null,
    active_login_last_seen_at: null,
  }).eq('id', userId)
}
