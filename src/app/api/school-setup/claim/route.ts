import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  token: z.string().min(1).max(200),
  accessToken: z.string().min(1).max(4000),
  fullName: z.string().trim().min(1).max(200),
}).strict()

// Completes bootstrap signup: the caller must already have created their own
// auth account client-side (supabase.auth.signUp(), since admin.createUser()
// doesn't work in this project — see provision-school-db.mjs). This route
// just verifies their token is still valid, grants them the first admin
// profile for this school, and burns the token so the link can't be reused.
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'school-setup-claim', { limit: 10, windowSeconds: 60 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { token, accessToken, fullName } = parsed.data

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('school_settings')
      .select('id')
      .eq('setup_token', token)
      .maybeSingle()

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'This setup link is invalid or has already been used.' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session. Please try signing up again.' }, { status: 401 })
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userData.user.id,
      full_name: fullName.trim(),
      role: 'admin',
      is_system_admin: false,
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // One-time use — clear it so this link can never be replayed.
    await supabaseAdmin.from('school_settings').update({ setup_token: null }).eq('id', settings.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('school-setup/claim error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
