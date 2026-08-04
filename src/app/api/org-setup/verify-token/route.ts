import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'

// Checks a setup token's validity without ever exposing the token value
// itself or the org's contact details back to the client until claimed.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('org_requests')
    .select('org_name, contact_email')
    .eq('setup_token', token)
    .is('setup_token_used_at', null)
    .maybeSingle()

  if (!data) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: true, orgName: data.org_name, contactEmail: data.contact_email })
}
