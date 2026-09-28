import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  requestId: z.string().uuid(),
  portalUrl: z.string().trim().url().max(500),
  accessToken: z.string().min(1).max(4000),
}).strict()

// A school's real portal address can change after it's first provisioned — most commonly, it
// starts out on its raw *.vercel.app URL and moves to its own branded domain once that's set up
// (see school-requests/provision-complete). This is how the owner corrects it afterwards, since
// "Find my school" and this whole table's portal_url column need to stay the real address.
export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { requestId, portalUrl, accessToken } = parsed.data

    const admin = await verifySystemAdmin(accessToken)
    if (!admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from('school_requests')
      .select('status')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    }
    if (request.status !== 'provisioned') {
      return NextResponse.json({ error: 'Only a provisioned school has a portal URL to correct.' }, { status: 400 })
    }

    const origin = new URL(portalUrl.trim()).origin
    const { error: updateError } = await supabaseAdmin.from('school_requests').update({ portal_url: origin }).eq('id', requestId)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, portalUrl: origin })
  } catch (err) {
    console.error('school-requests/update-portal-url error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
