import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
)

// Re-derives the caller's identity from their own access token rather than
// trusting a client-supplied user id, then checks the is_system_admin flag
// server-side — the same boundary the school-requests RLS policy enforces,
// checked again here since these routes use the service key and bypass RLS.
export async function verifySystemAdmin(accessToken: string | undefined): Promise<{ userId: string } | null> {
  if (!accessToken) return null

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData.user) return null

  const { data: profile } = await supabaseAdmin.from('profiles').select('is_system_admin').eq('id', userData.user.id).single()
  if (!profile?.is_system_admin) return null

  return { userId: userData.user.id }
}

export { supabaseAdmin }
