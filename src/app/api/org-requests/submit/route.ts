import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { orgRequestReceivedEmail } from '@/lib/emailTemplates'

export async function POST(req: NextRequest) {
  try {
    const { orgName, contactName, contactEmail, notes, honeypot, turnstileToken } = await req.json()

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    if (!orgName?.trim() || !contactName?.trim() || !contactEmail?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin.from('org_requests').insert({
      org_name: orgName.trim(),
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      notes: notes?.trim() || null,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    try {
      const { subject, html } = orgRequestReceivedEmail(orgName.trim(), contactName.trim())
      await sendEmail({ to: contactEmail.trim(), subject, html, from: EMAIL_FROM.onboarding })
    } catch (emailError) {
      // The request is already saved — don't fail the whole submission over
      // a flaky email send.
      console.error('org-request-received email failed:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('org-requests/submit error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
