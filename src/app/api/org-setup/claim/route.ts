import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  token: z.string().min(1).max(200),
  accessToken: z.string().min(1).max(4000),
  orgName: z.string().trim().min(1).max(200),
}).strict()

// The caller must already have created their own auth account client-side
// (supabase.auth.signUp()). This route verifies their token is still valid
// and unused, creates their organization row, and burns the token so the
// link can't be replayed.
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'org-setup-claim', { limit: 10, windowSeconds: 60 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { token, accessToken, orgName } = parsed.data

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session. Please try again.' }, { status: 401 })
    }

    // Check-and-burn the token in one atomic statement — the previous
    // version did a SELECT to check validity, then a separate UPDATE to
    // mark it used, so two concurrent requests with the same token could
    // both pass the check before either burned it, both creating an
    // organization from a link meant to be used exactly once.
    const { data: request, error: requestError } = await supabaseAdmin
      .from('org_requests')
      .update({ setup_token_used_at: new Date().toISOString() })
      .eq('setup_token', token)
      .is('setup_token_used_at', null)
      .select('id, contact_email')
      .maybeSingle()

    if (requestError || !request) {
      return NextResponse.json({ error: 'This setup link is invalid or has already been used.' }, { status: 400 })
    }

    const { error: orgError } = await supabaseAdmin.from('organizations').insert({
      auth_user_id: userData.user.id,
      name: orgName.trim(),
      contact_email: request.contact_email,
    })

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('org-setup/claim error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
