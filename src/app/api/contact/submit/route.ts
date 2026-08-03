import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { contactInquiryEmail } from '@/lib/emailTemplates'

const SALES_INBOX = 'sales@smartassessja.com'

export async function POST(req: NextRequest) {
  try {
    const { name, org, email, message, honeypot, turnstileToken } = await req.json()

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    if (!name?.trim() || !org?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
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
