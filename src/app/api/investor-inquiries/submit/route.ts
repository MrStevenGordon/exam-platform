import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { investorInquiryReceivedEmail, newInvestorInquiryStaffEmail } from '@/lib/emailTemplates'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const NOTIFY_INBOX = 'smartassessja@gmail.com'

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  firm: z.string().trim().max(200).optional(),
  note: z.string().trim().max(2000).optional(),
  honeypot: z.string().max(500).optional(),
  turnstileToken: z.string().max(4000).optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'investor-inquiries-submit', { limit: 5, windowSeconds: 3600 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { name, email, firm, note, honeypot, turnstileToken } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin.from('investor_inquiries').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      firm: firm?.trim() || null,
      note: note?.trim() || null,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Could not save inquiry.' }, { status: 400 })
    }

    try {
      const { subject, html } = investorInquiryReceivedEmail(name.trim())
      await sendEmail({ to: email.trim(), subject, html, from: EMAIL_FROM.onboarding })
    } catch (emailError) {
      console.error('investor-inquiry-received email failed:', emailError)
    }

    try {
      const { subject, html } = newInvestorInquiryStaffEmail(name.trim(), email.trim(), firm?.trim() || '', note?.trim() || '')
      await sendEmail({ to: NOTIFY_INBOX, subject, html, from: EMAIL_FROM.sales, replyTo: email.trim() })
    } catch (emailError) {
      console.error('new-investor-inquiry staff notification failed:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('investor-inquiries/submit error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
