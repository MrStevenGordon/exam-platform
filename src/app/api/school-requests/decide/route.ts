import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { acceptedEmail, rejectedEmail } from '@/lib/emailTemplates'
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
      .from('school_requests')
      .select('school_name, contact_name, contact_email, status')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('school_requests')
      .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: admin.userId })
      .eq('id', requestId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    try {
      const { subject, html } = decision === 'approved'
        ? acceptedEmail(request.school_name, request.contact_name)
        : rejectedEmail(request.school_name, request.contact_name)
      await sendEmail({ to: request.contact_email, subject, html, from: EMAIL_FROM.onboarding })
    } catch (emailError) {
      console.error(`${decision} email failed:`, emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('school-requests/decide error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
