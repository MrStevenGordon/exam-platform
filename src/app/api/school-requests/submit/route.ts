import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { submissionReceivedEmail } from '@/lib/emailTemplates'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'school-requests-submit', { limit: 5, windowSeconds: 3600 })
    if (limited) return limited

    const { schoolName, contactName, contactEmail, workflowTemplate, workflowOtherDescription, featureFlags, notes, honeypot, turnstileToken } = await req.json()

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    if (!schoolName?.trim() || !contactName?.trim() || !contactEmail?.trim() || !workflowTemplate) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin.from('school_requests').insert({
      school_name: schoolName.trim(),
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      workflow_template: workflowTemplate,
      workflow_other_description: workflowTemplate === 'other' ? (workflowOtherDescription || '').trim() : null,
      feature_flags: featureFlags || [],
      notes: notes?.trim() || null,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    try {
      const { subject, html } = submissionReceivedEmail(schoolName.trim(), contactName.trim())
      await sendEmail({ to: contactEmail.trim(), subject, html, from: EMAIL_FROM.onboarding })
    } catch (emailError) {
      // The request is already saved — don't fail the whole submission over
      // a flaky email send. Surface it in logs so it can be resent manually.
      console.error('submission-received email failed:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('school-requests/submit error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
