import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'

// Checks a bootstrap setup token's validity without ever exposing the token
// value itself back to the client — school_settings has a pre-existing
// "everyone can view" SELECT policy, so the token must never be readable
// via a direct client-side query, only validated server-side like this.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false }, { status: 400 })

  const { data } = await supabaseAdmin.from('school_settings').select('id').eq('setup_token', token).maybeSingle()

  return NextResponse.json({ valid: !!data })
}
