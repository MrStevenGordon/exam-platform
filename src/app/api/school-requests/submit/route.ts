import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { submissionReceivedEmail } from '@/lib/emailTemplates'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const schema = z.object({
  schoolName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(320),
  workflowTemplate: z.enum(['direct_publish', 'department_review', 'full_review', 'other']),
  workflowOtherDescription: z.string().trim().max(2000).optional(),
  featureFlags: z.array(z.string().max(100)).max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
  honeypot: z.string().max(500).optional(),
  turnstileToken: z.string().max(4000).optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'school-requests-submit', { limit: 5, windowSeconds: 3600 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { schoolName, contactName, contactEmail, workflowTemplate, workflowOtherDescription, featureFlags, notes, honeypot, turnstileToken } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
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
