import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { contactInquiryEmail } from '@/lib/emailTemplates'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const SALES_INBOX = 'smartassessja@gmail.com'

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  org: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(1).max(5000),
  honeypot: z.string().max(500).optional(),
  turnstileToken: z.string().max(4000).optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'contact-submit', { limit: 10, windowSeconds: 3600 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { name, org, email, message, honeypot, turnstileToken } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    const { subject, html } = contactInquiryEmail(name.trim(), org.trim(), email.trim(), message.trim())
    await sendEmail({ to: SALES_INBOX, subject, html, from: EMAIL_FROM.sales, replyTo: email.trim() })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('contact/submit error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
