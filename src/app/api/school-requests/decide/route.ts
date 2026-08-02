import { NextRequest, NextResponse } from 'next/server'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail } from '@/lib/email'
import { acceptedEmail, rejectedEmail } from '@/lib/emailTemplates'

export async function POST(req: NextRequest) {
  try {
    const { requestId, decision, accessToken } = await req.json()

    if (!requestId || (decision !== 'approved' && decision !== 'rejected')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

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
      await sendEmail({ to: request.contact_email, subject, html })
    } catch (emailError) {
      console.error(`${decision} email failed:`, emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('school-requests/decide error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
