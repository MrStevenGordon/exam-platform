import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'

// The caller must already have created their own auth account client-side
// (supabase.auth.signUp()). This route verifies their token is still valid
// and unused, creates their organization row, and burns the token so the
// link can't be replayed.
export async function POST(req: NextRequest) {
  try {
    const { token, accessToken, orgName } = await req.json()
    if (!token || !accessToken || !orgName?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const { data: request, error: requestError } = await supabaseAdmin
      .from('org_requests')
      .select('id, contact_email')
      .eq('setup_token', token)
      .is('setup_token_used_at', null)
      .maybeSingle()

    if (requestError || !request) {
      return NextResponse.json({ error: 'This setup link is invalid or has already been used.' }, { status: 400 })
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session. Please try again.' }, { status: 401 })
    }

    const { error: orgError } = await supabaseAdmin.from('organizations').insert({
      auth_user_id: userData.user.id,
      name: orgName.trim(),
      contact_email: request.contact_email,
    })

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 400 })
    }

    // One-time use — clear it so this link can never be replayed.
    await supabaseAdmin.from('org_requests').update({ setup_token_used_at: new Date().toISOString() }).eq('id', request.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('org-setup/claim error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
