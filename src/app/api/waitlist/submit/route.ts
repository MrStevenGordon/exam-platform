import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/verifySystemAdmin'
import { sendEmail, EMAIL_FROM } from '@/lib/email'
import { waitlistJoinedEmail, newWaitlistSignupStaffEmail } from '@/lib/emailTemplates'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { validateBody } from '@/lib/validateBody'

const SALES_INBOX = 'sales@smartassessja.com'

const schema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(200).optional(),
  schoolName: z.string().trim().max(200).optional(),
  honeypot: z.string().max(500).optional(),
  turnstileToken: z.string().max(4000).optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'waitlist-submit', { limit: 5, windowSeconds: 3600 })
    if (limited) return limited

    const parsed = await validateBody(req, schema)
    if ('error' in parsed) return parsed.error
    const { email, name, schoolName, honeypot, turnstileToken } = parsed.data

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin.from('waitlist_signups').insert({
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      school_name: schoolName?.trim() || null,
    })

    // Unique index on lower(email) — someone signing up twice is a success
    // from their point of view, not an error.
    if (insertError && insertError.code !== '23505') {
      return NextResponse.json({ error: insertError.message || 'Could not save signup.' }, { status: 400 })
    }

    try {
      const { subject, html } = waitlistJoinedEmail(email.trim())
      await sendEmail({ to: email.trim(), subject, html, from: EMAIL_FROM.onboarding })
    } catch (emailError) {
      console.error('waitlist-joined email failed:', emailError)
    }

    try {
      const { subject, html } = newWaitlistSignupStaffEmail(email.trim(), name?.trim() || '', schoolName?.trim() || '')
      await sendEmail({ to: SALES_INBOX, subject, html, from: EMAIL_FROM.sales })
    } catch (emailError) {
      console.error('new-waitlist-signup staff notification failed:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('waitlist/submit error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
