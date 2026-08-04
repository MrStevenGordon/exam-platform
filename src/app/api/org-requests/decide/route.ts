import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { orgRequestAcceptedEmail, orgRequestRejectedEmail } from '@/lib/emailTemplates'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  accessToken: z.string().min(1).max(4000),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { requestId, decision, accessToken } = parsed.data

    const admin = await verifySystemAdmin(accessToken)
    if (!admin) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from('org_requests')
      .select('org_name, contact_name, contact_email, status')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    }

    // Approving an org (unlike a school) doesn't need a separate database to
    // be provisioned first, so the setup token is generated and sent in the
    // same step here rather than as a second manual action.
    const setupToken = decision === 'approved' ? crypto.randomBytes(24).toString('hex') : null

    const { error: updateError } = await supabaseAdmin
      .from('org_requests')
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.userId,
        ...(setupToken ? { setup_token: setupToken } : {}),
      })
      .eq('id', requestId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    try {
      if (decision === 'approved' && setupToken) {
        const setupLink = new URL(`/org/setup/${setupToken}`, req.nextUrl.origin).toString()
        const { subject, html } = orgRequestAcceptedEmail(request.org_name, request.contact_name, setupLink)
        await sendEmail({ to: request.contact_email, subject, html, from: EMAIL_FROM.onboarding })
      } else {
        const { subject, html } = orgRequestRejectedEmail(request.org_name, request.contact_name)
        await sendEmail({ to: request.contact_email, subject, html, from: EMAIL_FROM.onboarding })
      }
    } catch (emailError) {
      console.error(`${decision} email failed:`, emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('org-requests/decide error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
