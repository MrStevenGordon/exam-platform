import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstile } from '@/lib/verifyTurnstile'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

// Checked before a public, unauthenticated signup form (org signup,
// Build My School) proceeds with creating anything. Honeypot field first
// (a hidden input real users never see, but naive bots that autofill every
// field will) — cheap, no user friction, catches most simple bots. Then
// Turnstile if it's configured. A sophisticated attacker could still call
// Supabase directly and skip this check entirely — this stops casual bot
// floods hitting the actual form, not a fully bulletproof gate.
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(getClientIp(req), 'verify-signup-guard', { limit: 10, windowSeconds: 60 })
    if (limited) return limited

    const { honeypot, turnstileToken } = await req.json()

    if (honeypot) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 })
    }

    const turnstileOk = await verifyTurnstile(turnstileToken)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('verify-signup-guard error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
