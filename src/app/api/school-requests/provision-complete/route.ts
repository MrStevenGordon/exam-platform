import { NextRequest, NextResponse } from 'next/server'
import { verifySystemAdmin, supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail } from '@/lib/email'
import { credentialsEmail } from '@/lib/emailTemplates'

// setupLink comes from scripts/provision-school-db.mjs — a one-time
// bootstrap link the school uses to self-register their first admin
// account, rather than us emailing raw credentials.
export async function POST(req: NextRequest) {
  try {
    const { requestId, setupLink, accessToken } = await req.json()

    if (!requestId || !setupLink?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
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

    if (request.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved requests can be marked as provisioned.' }, { status: 400 })
    }

    // Send first: if this fails, the request stays 'approved' so the admin
    // sees a clear error and can retry, rather than being silently marked
    // provisioned with no setup link ever having reached the school.
    const { subject, html } = credentialsEmail(request.school_name, request.contact_name, setupLink.trim())
    await sendEmail({ to: request.contact_email, subject, html })

    const portalUrl = new URL(setupLink.trim()).origin

    const { error: updateError } = await supabaseAdmin
      .from('school_requests')
      .update({ status: 'provisioned', provisioned_at: new Date().toISOString(), portal_url: portalUrl })
      .eq('id', requestId)

    if (updateError) {
      return NextResponse.json({ error: `Email sent, but failed to update status: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('school-requests/provision-complete error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
