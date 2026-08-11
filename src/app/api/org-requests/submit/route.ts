import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { orgRequestReceivedEmail, newOrgRequestStaffEmail } from '@/lib/emailTemplates'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'
import { generateRequestDraft } from '@/lib/draftRequestSummary'

const SALES_INBOX = 'smartassessja@gmail.com'

const schema = z.object({
  orgName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(320),
  notes: z.string().trim().max(2000).optional(),
  honeypot: z.string().max(500).optional(),
  turnstileToken: z.string().max(4000).optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'org-requests-submit', { limit: 5, windowSeconds: 3600 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { orgName, contactName, contactEmail, notes, honeypot, turnstileToken } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    const { data: inserted, error: insertError } = await supabaseAdmin.from('org_requests').insert({
      org_name: orgName.trim(),
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      notes: notes?.trim() || null,
    }).select('id').single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message || 'Could not save request.' }, { status: 400 })
    }

    try {
      const { subject, html } = orgRequestReceivedEmail(orgName.trim(), contactName.trim())
      await sendEmail({ to: contactEmail.trim(), subject, html, from: EMAIL_FROM.onboarding })
    } catch (emailError) {
      // The request is already saved — don't fail the whole submission over
      // a flaky email send.
      console.error('org-request-received email failed:', emailError)
    }

    try {
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
      const { subject, html } = newOrgRequestStaffEmail(orgName.trim(), contactName.trim(), contactEmail.trim(), `${origin}/owner/org-requests`)
      await sendEmail({ to: SALES_INBOX, subject, html, from: EMAIL_FROM.sales, replyTo: contactEmail.trim() })
    } catch (emailError) {
      console.error('new-org-request staff notification failed:', emailError)
    }

    try {
      const draft = await generateRequestDraft('org', {
        'Organization name': orgName.trim(),
        'Contact name': contactName.trim(),
        'Contact email': contactEmail.trim(),
        'Notes': notes?.trim() || '',
      })
      if (draft) {
        await supabaseAdmin.from('org_requests').update({ ai_draft: draft, ai_draft_generated_at: new Date().toISOString() }).eq('id', inserted.id)
      }
    } catch (draftError) {
      console.error('org request AI draft failed:', draftError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('org-requests/submit error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
